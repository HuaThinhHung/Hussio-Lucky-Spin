import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Campaign } from "@/generated/prisma/client";
import { runInBackground } from "@/server/background";
import { db, isUniqueViolation } from "@/server/db";
import { issueLuckyCode, normalizeOrderReference } from "@/server/lucky-codes";
import { cancelOrderRewards } from "@/server/rewards";
import { getShopifyConfig, isShopifyConfigured } from "@/server/shopify/client";
import { annotateShopifyOrder } from "@/server/shopify/orders";
import { markVouchersRedeemed } from "@/server/vouchers";

// ---------------------------------------------------------------------------
// HMAC verification
// ---------------------------------------------------------------------------

/** Verifies X-Shopify-Hmac-Sha256 (base64 HMAC-SHA256 of the raw body) in constant time. */
export function verifyShopifyHmac(rawBody: string | Buffer, hmacHeader: string | null, secret: string): boolean {
  if (!hmacHeader || !secret) return false;
  const digest = createHmac("sha256", secret).update(rawBody).digest();
  let received: Buffer;
  try {
    received = Buffer.from(hmacHeader, "base64");
  } catch {
    return false;
  }
  return received.length === digest.length && timingSafeEqual(received, digest);
}

// ---------------------------------------------------------------------------
// Order payload (REST-format JSON sent by order webhooks)
// ---------------------------------------------------------------------------

type ShopifyAddress = {
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  phone?: string | null;
  city?: string | null;
  province?: string | null;
};

export type ShopifyOrderPayload = {
  id: number | string;
  admin_graphql_api_id?: string;
  name?: string;
  created_at?: string;
  cancelled_at?: string | null;
  confirmed?: boolean;
  financial_status?: string | null;
  currency?: string;
  subtotal_price?: string | null;
  current_subtotal_price?: string | null;
  payment_gateway_names?: string[];
  gateway?: string | null;
  phone?: string | null;
  discount_codes?: { code: string }[];
  customer?: { first_name?: string | null; last_name?: string | null; phone?: string | null } | null;
  shipping_address?: ShopifyAddress | null;
  billing_address?: ShopifyAddress | null;
};

const COD_PATTERN = /(cash on delivery|\bcod\b|thanh to[aá]n khi nh[aậ]n)/i;

export function isCodOrder(order: ShopifyOrderPayload): boolean {
  const gateways = [...(order.payment_gateway_names ?? []), order.gateway ?? ""].filter(Boolean);
  return gateways.some((gateway) => COD_PATTERN.test(gateway));
}

/** Merchandise subtotal after discounts, excluding shipping (Shopify `subtotal_price`). */
export function orderSubtotal(order: ShopifyOrderPayload): number {
  const raw = order.current_subtotal_price ?? order.subtotal_price ?? "0";
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function joinName(first?: string | null, last?: string | null): string {
  // Vietnamese customers often type the full name in either field.
  return [last, first].filter((part) => part && part.trim()).join(" ").trim();
}

export function orderCustomer(order: ShopifyOrderPayload): { name: string; phone: string | null; city: string | null } {
  const address = order.shipping_address ?? order.billing_address ?? null;
  const name =
    address?.name?.trim() ||
    joinName(address?.first_name, address?.last_name) ||
    joinName(order.customer?.first_name, order.customer?.last_name) ||
    "Khách hàng HUSSIO";
  const phone =
    order.shipping_address?.phone || order.billing_address?.phone || order.customer?.phone || order.phone || null;
  const city = address?.province?.trim() || address?.city?.trim() || null;
  return { name, phone, city };
}

export type EligibilityDecision =
  | { action: "issue"; status: "ACTIVE" | "PENDING" }
  | { action: "wait"; reason: string }
  | { action: "ignore"; reason: string };

/**
 * Website rule: merchandise subtotal after discounts >= campaign minimum.
 * Prepaid orders get a code once PAID. COD follows campaign.codEligibilityMode.
 */
export function decideEligibility(
  order: ShopifyOrderPayload,
  campaign: Pick<
    Campaign,
    "minimumOrderValue" | "codEligibilityMode" | "startsAt" | "endsAt" | "ordersEndAt" | "currency"
  >,
): EligibilityDecision {
  if (order.cancelled_at) return { action: "ignore", reason: "order cancelled" };
  if (order.currency && order.currency !== campaign.currency) {
    return { action: "ignore", reason: `currency ${order.currency} != ${campaign.currency}` };
  }
  const createdAt = order.created_at ? new Date(order.created_at) : null;
  const ordersEndAt = campaign.ordersEndAt ?? campaign.endsAt;
  if (createdAt && campaign.startsAt && createdAt < campaign.startsAt) {
    return { action: "ignore", reason: "order placed before campaign start" };
  }
  if (createdAt && ordersEndAt && createdAt > ordersEndAt) {
    return { action: "ignore", reason: "order placed after the order deadline" };
  }
  const subtotal = orderSubtotal(order);
  if (subtotal < campaign.minimumOrderValue) {
    return { action: "ignore", reason: `subtotal ${subtotal} below minimum` };
  }

  const paid = order.financial_status === "paid";
  if (!isCodOrder(order)) {
    return paid ? { action: "issue", status: "ACTIVE" } : { action: "wait", reason: "prepaid order not paid yet" };
  }
  switch (campaign.codEligibilityMode) {
    case "PAID":
      return paid ? { action: "issue", status: "ACTIVE" } : { action: "wait", reason: "COD waiting for payment" };
    case "MANUAL_APPROVAL":
      return { action: "issue", status: "PENDING" };
    case "CONFIRMED_ORDER":
    default:
      return order.confirmed === false
        ? { action: "wait", reason: "COD order not confirmed" }
        : { action: "issue", status: "ACTIVE" };
  }
}

function orderGid(order: ShopifyOrderPayload): string {
  return order.admin_graphql_api_id ?? `gid://shopify/Order/${order.id}`;
}

function orderName(order: ShopifyOrderPayload): string {
  return normalizeOrderReference("SHOPIFY_WEB", order.name ?? String(order.id));
}

export const HANDLED_TOPICS = [
  "orders/create",
  "orders/paid",
  "orders/updated",
  "orders/cancelled",
  "refunds/create",
] as const;

type HandleOutcome = { status: "PROCESSED" | "IGNORED"; note: string };

async function handleOrderEvent(topic: string, order: ShopifyOrderPayload): Promise<HandleOutcome> {
  const reference = orderName(order);

  if (order.discount_codes?.length && topic !== "orders/cancelled") {
    await markVouchersRedeemed(order.discount_codes.map((d) => d.code), reference);
  }

  const fullyRefunded = order.financial_status === "refunded";
  if (topic === "orders/cancelled" || order.cancelled_at || fullyRefunded) {
    const result = await cancelOrderRewards(
      { channel: "SHOPIFY_WEB", orderReference: reference, reason: fullyRefunded ? "Đơn hoàn tiền toàn bộ" : "Đơn bị huỷ" },
      { adminUserId: null },
    );
    return {
      status: "PROCESSED",
      note: `cancelled ${result.cancelledCodes} code(s), voided ${result.voidedRewards} reward(s), kept ${result.skipped}`,
    };
  }

  const campaign = await db.campaign.findFirst({ where: { status: "ACTIVE" }, orderBy: { startsAt: "desc" } });
  if (!campaign) return { status: "IGNORED", note: "no active campaign" };

  const decision = decideEligibility(order, campaign);
  if (decision.action !== "issue") return { status: "IGNORED", note: decision.reason };

  const existing = await db.luckyCode.findUnique({
    where: { campaignId_channel_orderReference: { campaignId: campaign.id, channel: "SHOPIFY_WEB", orderReference: reference } },
  });
  if (existing) return { status: "IGNORED", note: `code already issued (${existing.status})` };

  const customer = orderCustomer(order);
  if (!customer.phone) return { status: "IGNORED", note: "order has no phone number — issue manually" };

  const result = await issueLuckyCode(
    {
      customerName: customer.name,
      phone: customer.phone,
      orderReference: reference,
      orderValue: orderSubtotal(order),
      channel: "SHOPIFY_WEB",
      customerCity: customer.city,
    },
    { campaign, source: "shopify_webhook", status: decision.status, shopifyOrderId: orderGid(order) },
  );
  if (!result.ok) return { status: "IGNORED", note: result.message };

  const { writeOrderTags } = getShopifyConfig();
  if (writeOrderTags && isShopifyConfigured()) {
    const code = result.luckyCode.code;
    runInBackground("order-annotate", () => annotateShopifyOrder(orderGid(order), code));
  }
  return { status: "PROCESSED", note: `issued ${result.luckyCode.status} code` };
}

export type WebhookInput = {
  topic: string;
  webhookId: string;
  shopDomain: string | null;
  payload: unknown;
};

/**
 * Idempotent processing: each X-Shopify-Webhook-Id is stored once (UNIQUE).
 * Retries of an already processed webhook are acknowledged without side effects;
 * failed ones are re-processed. Business logic is also idempotent per order.
 */
export async function processShopifyWebhook(input: WebhookInput): Promise<{ duplicate: boolean; outcome: HandleOutcome }> {
  const order = input.payload as ShopifyOrderPayload | null;
  const orderId = order && typeof order === "object" && "id" in order ? String(order.id) : null;

  let eventId: string;
  try {
    const created = await db.webhookEvent.create({
      data: { webhookId: input.webhookId, topic: input.topic, shopDomain: input.shopDomain, orderId },
    });
    eventId = created.id;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const previous = await db.webhookEvent.update({
      where: { webhookId: input.webhookId },
      data: { attempts: { increment: 1 } },
    });
    if (previous.status !== "FAILED" && previous.status !== "RECEIVED") {
      return { duplicate: true, outcome: { status: "IGNORED", note: "duplicate delivery" } };
    }
    eventId = previous.id;
  }

  try {
    let outcome: HandleOutcome;
    if (!(HANDLED_TOPICS as readonly string[]).includes(input.topic)) {
      outcome = { status: "IGNORED", note: `topic ${input.topic} not handled` };
    } else if (input.topic === "refunds/create") {
      // Full refunds arrive as orders/updated with financial_status=refunded.
      outcome = { status: "IGNORED", note: "refund recorded; full refunds handled via orders/updated" };
    } else if (!order || typeof order !== "object") {
      outcome = { status: "IGNORED", note: "empty payload" };
    } else {
      outcome = await handleOrderEvent(input.topic, order);
    }
    await db.webhookEvent.update({
      where: { id: eventId },
      data: { status: outcome.status, note: outcome.note.slice(0, 500), processedAt: new Date() },
    });
    return { duplicate: false, outcome };
  } catch (error) {
    await db.webhookEvent.update({
      where: { id: eventId },
      data: { status: "FAILED", note: (error instanceof Error ? error.message : String(error)).slice(0, 500) },
    });
    throw error;
  }
}
