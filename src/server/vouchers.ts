import "server-only";
import type { Campaign, Prize, Voucher } from "@/generated/prisma/client";
import { generateVoucherCode } from "@/lib/codes";
import { formatVndShort } from "@/lib/format";
import { runInBackground } from "@/server/background";
import { db, type Tx } from "@/server/db";
import { isShopifyConfigured } from "@/server/shopify/client";
import { createShopifyDiscount, deactivateShopifyDiscount } from "@/server/shopify/discounts";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 8;

/** Creates the voucher row inside the spin transaction. Shopify sync happens after commit. */
export async function createVoucherRecord(
  tx: Tx,
  params: { campaign: Campaign; prize: Prize; spinId: string; now: Date },
): Promise<Voucher> {
  const { campaign, prize, spinId, now } = params;
  if (prize.type !== "VOUCHER" && prize.type !== "FREE_SHIPPING") {
    throw new Error(`Prize ${prize.id} is not a voucher prize`);
  }

  // Pre-check instead of catching P2002: a failed INSERT would abort the whole transaction.
  let code = generateVoucherCode();
  for (let attempt = 1; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const taken = await tx.voucher.findUnique({ where: { code }, select: { id: true } });
    if (!taken) break;
    code = generateVoucherCode();
  }

  return tx.voucher.create({
    data: {
      campaignId: campaign.id,
      spinId,
      code,
      type: prize.type,
      value: prize.type === "VOUCHER" ? (prize.voucherValue ?? 0) : 0,
      minimumSpend: prize.voucherMinSpend,
      expiresAt: new Date(now.getTime() + campaign.voucherValidityDays * DAY_MS),
      syncStatus: isShopifyConfigured() ? "PENDING" : "SKIPPED",
    },
  });
}

function discountTitle(voucher: Pick<Voucher, "type" | "value" | "code">): string {
  const label = voucher.type === "FREE_SHIPPING" ? "Freeship" : `Voucher ${formatVndShort(voucher.value)}`;
  return `HUSSIO Lucky Spin – ${label} – ${voucher.code}`;
}

/** Creates the Shopify discount for a voucher (idempotent: skips when already synced). */
export async function syncVoucherToShopify(voucherId: string): Promise<Voucher> {
  const voucher = await db.voucher.findUniqueOrThrow({ where: { id: voucherId }, include: { campaign: true } });
  if (voucher.syncStatus === "SYNCED" && voucher.shopifyDiscountId) return voucher;
  if (!isShopifyConfigured()) {
    return db.voucher.update({ where: { id: voucherId }, data: { syncStatus: "SKIPPED", syncError: null } });
  }
  if (voucher.type !== "VOUCHER" && voucher.type !== "FREE_SHIPPING") {
    throw new Error(`Voucher ${voucherId} has unsupported type ${voucher.type}`);
  }

  try {
    const discountId = await createShopifyDiscount({
      code: voucher.code,
      title: discountTitle(voucher),
      kind: voucher.type,
      amount: voucher.value,
      minimumSubtotal: voucher.minimumSpend,
      startsAt: voucher.createdAt,
      endsAt: voucher.expiresAt,
      combinesWith: {
        orderDiscounts: voucher.campaign.voucherCombinesWithOrderDiscounts,
        productDiscounts: voucher.campaign.voucherCombinesWithProductDiscounts,
        shippingDiscounts: voucher.campaign.voucherCombinesWithShippingDiscounts,
      },
    });
    return db.voucher.update({
      where: { id: voucherId },
      data: { syncStatus: "SYNCED", shopifyDiscountId: discountId, syncError: null, syncedAt: new Date() },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[vouchers] Shopify sync failed", voucher.code, message);
    return db.voucher.update({
      where: { id: voucherId },
      data: { syncStatus: "FAILED", syncError: message.slice(0, 500) },
    });
  }
}

export function scheduleVoucherSync(voucherId: string): void {
  if (!isShopifyConfigured()) return;
  runInBackground("voucher-sync", async () => {
    await syncVoucherToShopify(voucherId);
  });
}

/** Deactivates the Shopify discount of a voided voucher (best effort, background). */
export function scheduleVoucherDeactivation(shopifyDiscountId: string | null): void {
  if (!shopifyDiscountId || !isShopifyConfigured()) return;
  runInBackground("voucher-deactivate", async () => {
    await deactivateShopifyDiscount(shopifyDiscountId);
  });
}

/** Marks vouchers used on a Shopify order as redeemed (from order webhooks). */
export async function markVouchersRedeemed(codes: string[], orderReference: string): Promise<number> {
  const normalized = codes.map((code) => code.trim().toUpperCase()).filter(Boolean);
  if (normalized.length === 0) return 0;
  const result = await db.voucher.updateMany({
    where: { code: { in: normalized }, status: "ISSUED" },
    data: { status: "REDEEMED", redeemedAt: new Date(), redeemedOrderRef: orderReference },
  });
  return result.count;
}
