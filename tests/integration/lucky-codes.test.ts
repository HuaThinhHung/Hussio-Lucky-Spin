import { beforeEach, describe, expect, it } from "vitest";
import type { Campaign } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { importLuckyCodesCsv, issueLuckyCode, parseChannel } from "@/server/lucky-codes";
import { resetDb, seedActiveCampaign } from "../helpers/db";

let campaign: Campaign;

beforeEach(async () => {
  await resetDb();
  campaign = await seedActiveCampaign();
});

const baseInput = {
  customerName: "Nguyễn Văn Nam",
  phone: "0987654321",
  orderReference: "FB-10234",
  orderValue: 1_300_000,
  channel: "FACEBOOK" as const,
};

describe("issuing lucky codes", () => {
  it("1.300.000đ -> code created (ACTIVE, phone stored only as hash)", async () => {
    const result = await issueLuckyCode(baseInput, { campaign, source: "admin" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.luckyCode.code).toMatch(/^HUSSIO-BF26-[A-Z2-9]{12}$/);
    expect(result.luckyCode.status).toBe("ACTIVE");
    expect(result.luckyCode.phoneHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.luckyCode.phoneHint).toBe("321");
    expect(JSON.stringify(result.luckyCode)).not.toContain("0987654321");
    expect(result.luckyCode.expiresAt?.getTime()).toBeGreaterThan(Date.now());
  });

  it("1.299.000đ -> rejected", async () => {
    const result = await issueLuckyCode({ ...baseInput, orderValue: 1_299_000 }, { campaign, source: "admin" });
    expect(result).toMatchObject({ ok: false, error: "BELOW_MINIMUM" });
    expect(await db.luckyCode.count()).toBe(0);
  });

  it("2.600.000đ -> still exactly one code (multi-spin disabled in MVP)", async () => {
    const result = await issueLuckyCode({ ...baseInput, orderValue: 2_600_000 }, { campaign, source: "admin" });
    expect(result.ok).toBe(true);
    expect(await db.luckyCode.count()).toBe(1);
  });

  it("duplicate order -> no duplicate code (also with different formatting)", async () => {
    const first = await issueLuckyCode(baseInput, { campaign, source: "admin" });
    const second = await issueLuckyCode({ ...baseInput, orderReference: " fb-10234 " }, { campaign, source: "admin" });
    expect(first.ok).toBe(true);
    expect(second).toMatchObject({ ok: false, error: "DUPLICATE_ORDER" });
    if (first.ok && !second.ok) expect(second.existingCode).toBe(first.luckyCode.code);
    expect(await db.luckyCode.count()).toBe(1);
  });

  it("concurrent duplicate submissions still produce one code", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => issueLuckyCode(baseInput, { campaign, source: "admin" })),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.luckyCode.count()).toBe(1);
  });

  it("the same reference on another channel is a different order", async () => {
    await issueLuckyCode(baseInput, { campaign, source: "admin" });
    const store = await issueLuckyCode({ ...baseInput, channel: "STORE" }, { campaign, source: "admin" });
    expect(store.ok).toBe(true);
  });

  it("rejects invalid phone numbers and ended campaigns", async () => {
    expect(await issueLuckyCode({ ...baseInput, phone: "123" }, { campaign, source: "admin" })).toMatchObject({
      ok: false,
      error: "INVALID_PHONE",
    });
    const ended = await db.campaign.update({ where: { id: campaign.id }, data: { status: "ENDED" } });
    expect(await issueLuckyCode(baseInput, { campaign: ended, source: "admin" })).toMatchObject({
      ok: false,
      error: "CAMPAIGN_ENDED",
    });
  });
});

describe("CSV bulk import", () => {
  it("creates codes for valid rows and reports invalid ones", async () => {
    const csv = [
      "customer_name,phone,order_reference,order_value,channel",
      "Nguyễn Văn Nam,0912345678,FB-1,1.450.000,FACEBOOK",
      "Trần Minh,0987654321,BILL-9,1300000,cửa hàng",
      "Lê An,0901111222,FB-2,1299000,FACEBOOK",
      "Phạm Bình,12,FB-3,1500000,FACEBOOK",
      "Nguyễn Văn Nam,0912345678,FB-1,1450000,FACEBOOK",
      "Hồ Duy,0933444555,X-1,1500000,tiktok",
    ].join("\n");
    const summary = await importLuckyCodesCsv(csv, { createdById: null });
    expect(summary.created).toBe(2);
    expect(summary.failed).toBe(4);
    expect(summary.rows.map((row) => row.ok)).toEqual([true, true, false, false, false, false]);
    expect(await db.luckyCode.count()).toBe(2);
    const store = await db.luckyCode.findFirstOrThrow({ where: { orderReference: "BILL-9" } });
    expect(store.channel).toBe("STORE");
  });

  it("reports missing columns", async () => {
    const summary = await importLuckyCodesCsv("name,phone\nA,0912345678", { createdById: null });
    expect(summary.error).toContain("Thiếu cột");
  });

  it("parses channel aliases", () => {
    expect(parseChannel("Website")).toBe("SHOPIFY_WEB");
    expect(parseChannel("fb")).toBe("FACEBOOK");
    expect(parseChannel("Cửa hàng")).toBe("STORE");
    expect(parseChannel("tiktok")).toBeNull();
  });
});
