import { beforeEach, describe, expect, it } from "vitest";
import type { Campaign } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { voidReward } from "@/server/rewards";
import { confirmProductReward, performSpin, validateLuckyCode } from "@/server/spin";
import { issueTestCode, prizeByName, resetDb, seedActiveCampaign, setPoolStock } from "../helpers/db";

const PHONE = "0912345678";
let campaign: Campaign;

beforeEach(async () => {
  await resetDb();
  campaign = await seedActiveCampaign();
});

/** RNG that always lands on the given prize (by its cumulative weight range). */
async function rngFor(prizeName: string) {
  const prizes = await db.prize.findMany({
    where: { campaignId: campaign.id, active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  let offset = 0;
  for (const prize of prizes) {
    if (prize.name === prizeName) return (max: number) => Math.min(offset, max - 1);
    offset += prize.weight;
  }
  throw new Error(`prize ${prizeName} not found`);
}

describe("validate code", () => {
  it("valid code + phone -> READY with one spin", async () => {
    const code = await issueTestCode(campaign);
    const result = await validateLuckyCode({ code: code.code.toLowerCase(), phone: "+84 912 345 678" });
    expect(result).toMatchObject({ ok: true, state: "READY", spinsAvailable: 1, customerName: "Hưng" });
  });

  it("requires only a valid code; pending and unknown codes cannot spin", async () => {
    const code = await issueTestCode(campaign);
    expect(await validateLuckyCode({ code: code.code })).toMatchObject({ ok: true, state: "READY" });
    expect(await performSpin({ code: "HUSSIO-BF26-ZZZZZZ" })).toMatchObject({ error: "INVALID_CODE" });
    await db.luckyCode.update({ where: { id: code.id }, data: { status: "PENDING" } });
    expect(await performSpin({ code: code.code })).toMatchObject({ error: "PENDING_APPROVAL" });
    expect(await db.spin.count()).toBe(0);
  });

  it("expired code and inactive campaign are refused", async () => {
    const code = await issueTestCode(campaign);
    await db.luckyCode.update({ where: { id: code.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await validateLuckyCode({ code: code.code, phone: PHONE })).toMatchObject({ error: "EXPIRED" });

    const other = await issueTestCode(campaign);
    await db.campaign.update({ where: { id: campaign.id }, data: { status: "PAUSED" } });
    expect(await validateLuckyCode({ code: other.code, phone: PHONE })).toMatchObject({ error: "CAMPAIGN_PAUSED" });
    await db.campaign.update({ where: { id: campaign.id }, data: { status: "ACTIVE", endsAt: new Date(Date.now() - 1000) } });
    expect(await validateLuckyCode({ code: other.code, phone: PHONE })).toMatchObject({ error: "CAMPAIGN_ENDED" });
  });
});

describe("spin", () => {
  it("valid code -> exactly one prize, code burned, winner saved", async () => {
    const code = await issueTestCode(campaign);
    const response = await performSpin({ code: code.code, phone: PHONE });
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.repeated).toBe(false);
    expect(response.result.segmentCount).toBe(9);
    expect(response.result.segmentIndex).toBeGreaterThanOrEqual(0);
    expect(response.result.segmentIndex).toBeLessThan(9);

    const prizes = await db.prize.findMany({ where: { campaignId: campaign.id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }] });
    expect(prizes[response.result.segmentIndex].id).toBe(response.result.prizeId);

    expect(await db.spin.count()).toBe(1);
    expect(await db.winner.count()).toBe(1);
    expect((await db.luckyCode.findUniqueOrThrow({ where: { id: code.id } })).status).toBe("USED");
    const spin = await db.spin.findFirstOrThrow();
    expect(spin.randomValue).toBeLessThan(spin.totalWeight);
    expect(spin.totalWeight).toBe(100);
  });

  it("same code twice -> same previous result, never a second spin", async () => {
    const code = await issueTestCode(campaign);
    const first = await performSpin({ code: code.code, phone: PHONE });
    const second = await performSpin({ code: code.code, phone: PHONE });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.repeated).toBe(true);
    expect(second.result.spinId).toBe(first.result.spinId);
    expect(second.result.prizeId).toBe(first.result.prizeId);
    expect(await db.spin.count()).toBe(1);

    const again = await validateLuckyCode({ code: code.code, phone: PHONE });
    expect(again).toMatchObject({ ok: true, state: "ALREADY_SPUN" });
  });

  it("concurrent requests (double click / two tabs) -> only one spin", async () => {
    const code = await issueTestCode(campaign);
    const responses = await Promise.all(Array.from({ length: 8 }, () => performSpin({ code: code.code })));
    const ok = responses.filter((r) => r.ok);
    expect(ok).toHaveLength(8);
    const spinIds = new Set(ok.map((r) => (r.ok ? r.result.spinId : "")));
    expect(spinIds.size).toBe(1);
    expect(ok.filter((r) => r.ok && !r.repeated)).toHaveLength(1);
    expect(await db.spin.count()).toBe(1);
    expect(await db.winner.count()).toBe(1);
  });

  it("voucher prize -> unique HUSSIO-WHEEL code valid 30 days (MOCK sync)", async () => {
    const code = await issueTestCode(campaign);
    const response = await performSpin({ code: code.code, phone: PHONE }, { randomInt: await rngFor("Voucher 100K") });
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.result.prizeHeadline).toBe("VOUCHER 100.000Đ");
    expect(response.result.voucher?.code).toMatch(/^HUSSIO-WHEEL-[A-Z2-9]{6}$/);
    expect(response.result.voucher?.minimumSpend).toBe(899_000);
    const voucher = await db.voucher.findFirstOrThrow();
    expect(voucher.value).toBe(100_000);
    expect(voucher.syncStatus).toBe("SKIPPED");
    const days = (voucher.expiresAt.getTime() - voucher.createdAt.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(30);
  });

  it("physical prize -> gift inventory decreases", async () => {
    const polo = await prizeByName(campaign.id, "Áo Polo HUSSIO");
    const before = await db.giftItem.aggregate({ where: { giftPoolId: polo.giftPoolId! }, _sum: { quantity: true } });
    const code = await issueTestCode(campaign);
    const response = await performSpin({ code: code.code, phone: PHONE }, { randomInt: await rngFor("Áo Polo HUSSIO") });
    expect(response.ok && response.result.prizeHeadline).toBe("01 ÁO POLO HUSSIO");
    const after = await db.giftItem.aggregate({ where: { giftPoolId: polo.giftPoolId! }, _sum: { quantity: true } });
    expect(after._sum.quantity).toBe((before._sum.quantity ?? 0) - 1);
    const pool = await db.giftPool.findUniqueOrThrow({ where: { id: polo.giftPoolId! } });
    expect(pool.quantityRemaining).toBe(82);
    expect(pool.quantityTotal).toBe(83);
    expect((await db.spin.findFirstOrThrow()).giftItemId).not.toBeNull();
  });

  it("Polo stock 0 -> Polo excluded even when the RNG points at it", async () => {
    await setPoolStock(campaign.id, "POLO", 0);
    const poloRng = await rngFor("Áo Polo HUSSIO");
    for (let i = 0; i < 15; i += 1) {
      const code = await issueTestCode(campaign);
      const response = await performSpin({ code: code.code, phone: PHONE }, { randomInt: poloRng });
      expect(response.ok).toBe(true);
      if (response.ok) expect(response.result.prizeName).not.toBe("Áo Polo HUSSIO");
    }
    for (let i = 0; i < 25; i += 1) {
      const code = await issueTestCode(campaign);
      const response = await performSpin({ code: code.code, phone: PHONE });
      if (response.ok) expect(response.result.prizeName).not.toBe("Áo Polo HUSSIO");
    }
  });

  it("all physical stock 0 -> vouchers / freeship still work", async () => {
    for (const category of ["POLO", "TSHIRT", "SHIRT", "JACKET", "PANTS"] as const) await setPoolStock(campaign.id, category, 0);
    for (let i = 0; i < 20; i += 1) {
      const code = await issueTestCode(campaign);
      const response = await performSpin({ code: code.code, phone: PHONE });
      expect(response.ok).toBe(true);
      if (response.ok) expect(["VOUCHER", "FREE_SHIPPING"]).toContain(response.result.prizeType);
    }
  });

  it("prize quota (stockLimit) is respected", async () => {
    const voucher30 = await prizeByName(campaign.id, "Voucher 30K");
    await db.prize.update({ where: { id: voucher30.id }, data: { stockLimit: 1 } });
    const rng = await rngFor("Voucher 30K");
    const first = await performSpin({ code: (await issueTestCode(campaign)).code, phone: PHONE }, { randomInt: rng });
    const second = await performSpin({ code: (await issueTestCode(campaign)).code, phone: PHONE }, { randomInt: rng });
    expect(first.ok && first.result.prizeName).toBe("Voucher 30K");
    expect(second.ok && second.result.prizeName).not.toBe("Voucher 30K");
  });

  it("no prize available at all -> NO_PRIZES and the code stays usable", async () => {
    await db.prize.updateMany({ where: { campaignId: campaign.id }, data: { weight: 0 } });
    const code = await issueTestCode(campaign);
    expect(await performSpin({ code: code.code, phone: PHONE })).toMatchObject({ ok: false, error: "NO_PRIZES" });
    expect((await db.luckyCode.findUniqueOrThrow({ where: { id: code.id } })).status).toBe("ACTIVE");
  });

  it("accessory quota is atomic and the prize needs no size form", async () => {
    await db.prize.updateMany({ where: { campaignId: campaign.id }, data: { active: false } });
    await db.prize.create({ data: { campaignId: campaign.id, name: "Vớ", wheelLabel: "VỚ", type: "PRODUCT_POOL", weight: 1, stockLimit: 1 } });
    const codes = await Promise.all([issueTestCode(campaign), issueTestCode(campaign)]);
    const results = await Promise.all(codes.map(code => performSpin({ code: code.code })));
    expect(results.filter(r => r.ok)).toHaveLength(1);
    expect(results.filter(r => !r.ok && r.error === "NO_PRIZES")).toHaveLength(1);
    const won = results.find(r => r.ok);
    expect(won?.ok && won.result.product).toBeNull();
    expect(await db.luckyCode.count({ where: { status: "USED" } })).toBe(1);
  });

  it("a code without a phone can spin", async () => {
    const code = await issueTestCode(campaign);
    expect(await performSpin({ code: code.code })).toMatchObject({ ok: true, repeated: false });
  });
});

describe("product reward confirmation + void", () => {
  it("records a size preference when the pool has no size breakdown", async () => {
    const code = await issueTestCode(campaign);
    await performSpin({ code: code.code, phone: PHONE }, { randomInt: await rngFor("Sơ mi HUSSIO") });
    const confirmed = await confirmProductReward({ code: code.code, phone: PHONE, size: "xl", note: "Màu trắng" });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.result.product).toMatchObject({ sizePreference: "XL", sizeStockKnown: false, customerConfirmed: true });
    expect(confirmed.result.product?.sizeOptions).toEqual(["M", "L", "XL", "XXL"]);
  });

  it("with stock by size, only in-stock sizes are offered and the item is swapped", async () => {
    const polo = await prizeByName(campaign.id, "Áo Polo HUSSIO");
    await db.giftItem.deleteMany({ where: { giftPoolId: polo.giftPoolId! } });
    await db.giftItem.createMany({
      data: [
        { giftPoolId: polo.giftPoolId!, productName: "Polo Blok", category: "POLO", size: "M", quantity: 1, cost: 90_000 },
        { giftPoolId: polo.giftPoolId!, productName: "Polo Blok", category: "POLO", size: "L", quantity: 2, cost: 90_000 },
        { giftPoolId: polo.giftPoolId!, productName: "Polo Blok", category: "POLO", size: "XXL", quantity: 0, cost: 90_000 },
      ],
    });
    const code = await issueTestCode(campaign);
    const spun = await performSpin({ code: code.code, phone: PHONE }, { randomInt: () => 0 /* first prize = 30K */ });
    expect(spun.ok).toBe(true);
    // Force a polo spin on a fresh code.
    const poloCode = await issueTestCode(campaign);
    const poloSpin = await performSpin({ code: poloCode.code, phone: PHONE }, { randomInt: await rngFor("Áo Polo HUSSIO") });
    expect(poloSpin.ok).toBe(true);
    if (!poloSpin.ok) return;
    expect(poloSpin.result.product?.sizeStockKnown).toBe(true);
    expect(poloSpin.result.product?.sizeOptions).not.toContain("XXL");

    const result = await confirmProductReward({ code: poloCode.code, phone: PHONE, size: "L" });
    expect(result.ok).toBe(true);
    const spin = await db.spin.findUniqueOrThrow({ where: { id: poloSpin.result.spinId }, include: { giftItem: true } });
    expect(spin.giftItem?.size).toBe("L");
    const total = await db.giftItem.aggregate({ where: { giftPoolId: polo.giftPoolId! }, _sum: { quantity: true } });
    expect(total._sum.quantity).toBe(2); // 3 units - 1 allocated

    expect(await confirmProductReward({ code: poloCode.code, phone: PHONE, size: "XXL" })).toMatchObject({ error: "SIZE_UNAVAILABLE" });
  });

  it("voiding a reward returns stock and keeps the spin history", async () => {
    const code = await issueTestCode(campaign);
    const spun = await performSpin({ code: code.code, phone: PHONE }, { randomInt: await rngFor("Áo khoác HUSSIO") });
    expect(spun.ok).toBe(true);
    if (!spun.ok) return;
    const jacket = await prizeByName(campaign.id, "Áo khoác HUSSIO");
    const stockAfterWin = await db.giftItem.aggregate({ where: { giftPoolId: jacket.giftPoolId! }, _sum: { quantity: true } });
    expect(stockAfterWin._sum.quantity).toBe(11);

    expect(await voidReward(spun.result.spinId, "Đơn huỷ", { adminUserId: null })).toEqual({ ok: true });
    const stockAfterVoid = await db.giftItem.aggregate({ where: { giftPoolId: jacket.giftPoolId! }, _sum: { quantity: true } });
    expect(stockAfterVoid._sum.quantity).toBe(12);
    expect(await db.spin.count()).toBe(1);
    expect((await db.winner.findFirstOrThrow()).status).toBe("VOID");

    const history = await validateLuckyCode({ code: code.code, phone: PHONE });
    expect(history).toMatchObject({ ok: true, state: "ALREADY_SPUN", result: { rewardStatus: "VOID" } });
  });
});
