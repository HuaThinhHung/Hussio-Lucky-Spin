import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { Campaign } from "@/generated/prisma/client";
import { GET as winnersRoute } from "@/app/api/winners/route";
import { POST as webhookRoute } from "@/app/api/webhooks/shopify/route";
import { db } from "@/server/db";
import { performSpin } from "@/server/spin";
import { processShopifyWebhook, type ShopifyOrderPayload } from "@/server/shopify/webhooks";
import { getRecentWinners } from "@/server/winners";
import { issueTestCode, resetDb, seedActiveCampaign } from "../helpers/db";

let campaign: Campaign;

beforeEach(async () => {
  await resetDb();
  campaign = await seedActiveCampaign();
});

describe("public winner feed privacy", () => {
  it("contains masked names only — no phone, email, order reference or address", async () => {
    const code = await issueTestCode(campaign, {
      customerName: "Nguyễn Văn Nam",
      phone: "0912345678",
      orderReference: "FB-SECRET-77",
      customerCity: "Hà Nội",
    });
    await performSpin({ code: code.code, phone: "0912345678" });

    const winners = await getRecentWinners();
    expect(winners).toHaveLength(1);
    expect(winners[0]).toMatchObject({ displayName: "Nguyễn V*** N**", city: "Hà Nội" });
    expect(Object.keys(winners[0]).sort()).toEqual(["city", "createdAt", "displayName", "id", "prizeName", "prizeType"]);

    const response = await winnersRoute();
    const body = await response.text();
    for (const secret of ["0912345678", "912345678", "FB-SECRET-77", "@", code.code, "Văn Nam", code.phoneHash]) {
      expect(body).not.toContain(secret);
    }
  });

  it("shows nothing when nobody has spun (no fake winners) and hides voided rewards", async () => {
    expect(await getRecentWinners()).toEqual([]);
    const code = await issueTestCode(campaign);
    const spun = await performSpin({ code: code.code, phone: "0912345678" });
    if (!spun.ok) throw new Error("spin failed");
    await db.winner.update({ where: { spinId: spun.result.spinId }, data: { status: "VOID" } });
    expect(await getRecentWinners()).toEqual([]);
  });
});

function order(overrides: Partial<ShopifyOrderPayload> = {}): ShopifyOrderPayload {
  return {
    id: 5550001,
    admin_graphql_api_id: "gid://shopify/Order/5550001",
    name: "#1042",
    created_at: new Date().toISOString(),
    currency: "VND",
    subtotal_price: "1350000",
    financial_status: "paid",
    payment_gateway_names: ["VNPAY"],
    confirmed: true,
    shipping_address: { name: "Hứa Hưng", phone: "+84912345678", province: "Hồ Chí Minh", city: "Quận 1" },
    ...overrides,
  };
}

describe("Shopify webhooks", () => {
  it("eligible PAID order -> one lucky code; retries are idempotent", async () => {
    for (let i = 0; i < 3; i += 1) {
      await processShopifyWebhook({ topic: "orders/paid", webhookId: "wh-1", shopDomain: null, payload: order() });
    }
    await processShopifyWebhook({ topic: "orders/create", webhookId: "wh-2", shopDomain: null, payload: order() });
    await processShopifyWebhook({ topic: "orders/updated", webhookId: "wh-3", shopDomain: null, payload: order() });

    const codes = await db.luckyCode.findMany();
    expect(codes).toHaveLength(1);
    expect(codes[0]).toMatchObject({ channel: "SHOPIFY_WEB", orderReference: "#1042", status: "ACTIVE", orderValue: 1_350_000, phoneHint: "678" });
    const event = await db.webhookEvent.findUniqueOrThrow({ where: { webhookId: "wh-1" } });
    expect(event.attempts).toBe(3);
    expect(await db.webhookEvent.count()).toBe(3);
  });

  it("below threshold / unpaid prepaid orders get no code", async () => {
    await processShopifyWebhook({ topic: "orders/paid", webhookId: "a", shopDomain: null, payload: order({ subtotal_price: "1299000" }) });
    await processShopifyWebhook({ topic: "orders/create", webhookId: "b", shopDomain: null, payload: order({ id: 2, name: "#1043", financial_status: "pending" }) });
    expect(await db.luckyCode.count()).toBe(0);
  });

  it("COD MANUAL_APPROVAL -> PENDING code", async () => {
    await db.campaign.update({ where: { id: campaign.id }, data: { codEligibilityMode: "MANUAL_APPROVAL" } });
    await processShopifyWebhook({
      topic: "orders/create",
      webhookId: "cod-1",
      shopDomain: null,
      payload: order({ financial_status: "pending", payment_gateway_names: ["Cash on Delivery (COD)"] }),
    });
    expect((await db.luckyCode.findFirstOrThrow()).status).toBe("PENDING");
  });

  it("order cancelled before spin -> code CANCELLED", async () => {
    await processShopifyWebhook({ topic: "orders/paid", webhookId: "p", shopDomain: null, payload: order() });
    await processShopifyWebhook({ topic: "orders/cancelled", webhookId: "c", shopDomain: null, payload: order({ cancelled_at: new Date().toISOString() }) });
    expect((await db.luckyCode.findFirstOrThrow()).status).toBe("CANCELLED");
  });

  it("order cancelled after spin -> spin kept, reward VOID", async () => {
    await processShopifyWebhook({ topic: "orders/paid", webhookId: "p2", shopDomain: null, payload: order() });
    const code = await db.luckyCode.findFirstOrThrow();
    const spun = await performSpin({ code: code.code, phone: "0912345678" });
    expect(spun.ok).toBe(true);
    await processShopifyWebhook({ topic: "orders/cancelled", webhookId: "c2", shopDomain: null, payload: order({ cancelled_at: new Date().toISOString() }) });
    expect(await db.spin.count()).toBe(1);
    expect((await db.winner.findFirstOrThrow()).status).toBe("VOID");
    expect((await db.luckyCode.findFirstOrThrow()).status).toBe("USED");
  });

  it("marks wheel vouchers as redeemed when used on a later order", async () => {
    const code = await issueTestCode(campaign);
    const prizes = await db.prize.findMany({ where: { campaignId: campaign.id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }] });
    expect(prizes[0].type).toBe("VOUCHER");
    const spun = await performSpin({ code: code.code, phone: "0912345678" }, { randomInt: () => 0 });
    if (!spun.ok || !spun.result.voucher) throw new Error("expected a voucher");
    await processShopifyWebhook({
      topic: "orders/create",
      webhookId: "redeem",
      shopDomain: null,
      payload: order({ id: 99, name: "#2000", subtotal_price: "500000", discount_codes: [{ code: spun.result.voucher.code }] }),
    });
    const voucher = await db.voucher.findFirstOrThrow();
    expect(voucher).toMatchObject({ status: "REDEEMED", redeemedOrderRef: "#2000" });
  });

  it("route rejects bad HMAC and accepts a signed webhook", async () => {
    const body = JSON.stringify(order());
    const headers = { "content-type": "application/json", "x-shopify-topic": "orders/paid", "x-shopify-webhook-id": "route-1" };

    const bad = await webhookRoute(
      new Request("http://localhost/api/webhooks/shopify", { method: "POST", body, headers: { ...headers, "x-shopify-hmac-sha256": "invalid" } }),
    );
    expect(bad.status).toBe(401);
    expect(await db.luckyCode.count()).toBe(0);

    const hmac = createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET!).update(body).digest("base64");
    const good = await webhookRoute(
      new Request("http://localhost/api/webhooks/shopify", { method: "POST", body, headers: { ...headers, "x-shopify-hmac-sha256": hmac } }),
    );
    expect(good.status).toBe(200);
    expect(await db.luckyCode.count()).toBe(1);
  });
});
