import { seedCampaign } from "../../prisma/seed-data";
import type { Campaign, Prize } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { issueLuckyCode, type IssueCodeInput } from "@/server/lucky-codes";

const TABLES = [
  "AnalyticsEvent",
  "AdminAuditLog",
  "AdminSession",
  "AdminUser",
  "WebhookEvent",
  "Winner",
  "Voucher",
  "Spin",
  "LuckyCode",
  "Prize",
  "GiftItem",
  "GiftPool",
  "Campaign",
  "RateLimitBucket",
];

export async function resetDb(): Promise<void> {
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

const DAY = 24 * 60 * 60 * 1000;

/** Default seed with an ACTIVE campaign whose window contains "now". */
export async function seedActiveCampaign(): Promise<Campaign> {
  return seedCampaign(db, {
    status: "ACTIVE",
    startsAt: new Date(Date.now() - DAY),
    ordersEndAt: new Date(Date.now() + 10 * DAY),
    endsAt: new Date(Date.now() + 20 * DAY),
  });
}

let orderSeq = 0;

export async function issueTestCode(campaign: Campaign, overrides: Partial<IssueCodeInput> = {}) {
  orderSeq += 1;
  const result = await issueLuckyCode(
    {
      customerName: "Hứa Hưng",
      phone: "0912345678",
      orderReference: `FB-TEST-${orderSeq}`,
      orderValue: 1_300_000,
      channel: "FACEBOOK",
      customerCity: "TP. Hồ Chí Minh",
      ...overrides,
    },
    { campaign, source: "admin" },
  );
  if (!result.ok) throw new Error(`issueTestCode failed: ${result.message}`);
  return result.luckyCode;
}

export async function prizeByName(campaignId: string, name: string): Promise<Prize> {
  return db.prize.findFirstOrThrow({ where: { campaignId, name } });
}

/** Sets every item in a gift pool (by category) to `quantity`. */
export async function setPoolStock(campaignId: string, category: "POLO" | "TSHIRT" | "SHIRT" | "JACKET" | "PANTS", quantity: number) {
  const pool = await db.giftPool.findUniqueOrThrow({ where: { campaignId_category: { campaignId, category } } });
  await db.giftItem.updateMany({ where: { giftPoolId: pool.id }, data: { quantity } });
  return pool;
}
