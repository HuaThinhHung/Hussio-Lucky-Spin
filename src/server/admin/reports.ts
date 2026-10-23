import "server-only";
import type { Channel } from "@/generated/prisma/enums";
import { ANALYTICS_EVENTS } from "@/lib/constants";
import { db } from "@/server/db";

export type DashboardStats = {
  codesIssued: number;
  codesPending: number;
  codesUnspun: number;
  spins: number;
  conversion: number;
  vouchersIssued: number;
  voucherFaceValue: number;
  physicalWon: number;
  physicalPending: number;
  giftUnitsRemaining: number;
  giftCostRemaining: number;
  expectedGiftCost: number;
  byChannel: Record<Channel, number>;
};

export async function getDashboardStats(campaignId: string): Promise<DashboardStats> {
  const [codesIssued, codesPending, codesUnspun, spins, vouchers, physicalWon, physicalPending, giftUnits, channelRows] =
    await Promise.all([
      db.luckyCode.count({ where: { campaignId, status: { not: "PENDING" } } }),
      db.luckyCode.count({ where: { campaignId, status: "PENDING" } }),
      db.luckyCode.count({ where: { campaignId, status: "ACTIVE" } }),
      db.spin.count({ where: { campaignId } }),
      db.voucher.aggregate({ where: { campaignId, status: { not: "VOID" } }, _count: true, _sum: { value: true } }),
      db.winner.count({ where: { campaignId, status: { not: "VOID" }, prize: { type: "PRODUCT_POOL" } } }),
      db.winner.count({ where: { campaignId, status: { in: ["WON", "CONFIRMED"] }, prize: { type: "PRODUCT_POOL" } } }),
      db.giftItem.aggregate({ where: { giftPool: { campaignId }, active: true }, _sum: { quantity: true } }),
      db.luckyCode.groupBy({ by: ["channel"], where: { campaignId, status: { not: "PENDING" } }, _count: true }),
    ]);

  const [costRemaining] = await db.$queryRaw<{ total: bigint | null }[]>`
    SELECT SUM(gi."quantity" * gi."cost")::bigint AS total
    FROM "GiftItem" gi JOIN "GiftPool" gp ON gp."id" = gi."giftPoolId"
    WHERE gp."campaignId" = ${campaignId} AND gi."active" = true`;
  const [costWon] = await db.$queryRaw<{ total: bigint | null }[]>`
    SELECT SUM(gi."cost")::bigint AS total
    FROM "Spin" s JOIN "GiftItem" gi ON gi."id" = s."giftItemId"
    WHERE s."campaignId" = ${campaignId} AND s."status" = 'COMPLETED'`;

  const byChannel: Record<Channel, number> = { SHOPIFY_WEB: 0, FACEBOOK: 0, STORE: 0 };
  for (const row of channelRows) byChannel[row.channel] = row._count;

  return {
    codesIssued,
    codesPending,
    codesUnspun,
    spins,
    conversion: codesIssued > 0 ? spins / codesIssued : 0,
    vouchersIssued: vouchers._count,
    voucherFaceValue: vouchers._sum.value ?? 0,
    physicalWon,
    physicalPending,
    giftUnitsRemaining: giftUnits._sum.quantity ?? 0,
    giftCostRemaining: Number(costRemaining?.total ?? 0),
    expectedGiftCost: Number(costWon?.total ?? 0),
    byChannel,
  };
}

export type PrizeDistributionRow = {
  prizeId: string;
  name: string;
  weight: number;
  configuredShare: number;
  won: number;
  actualShare: number;
};

export async function getPrizeDistribution(campaignId: string): Promise<PrizeDistributionRow[]> {
  const prizes = await db.prize.findMany({ where: { campaignId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const counts = await db.spin.groupBy({ by: ["prizeId"], where: { campaignId }, _count: true });
  const wonById = new Map(counts.map((row) => [row.prizeId, row._count]));
  const totalWeight = prizes.filter((p) => p.active).reduce((sum, p) => sum + p.weight, 0);
  const totalWon = counts.reduce((sum, row) => sum + row._count, 0);
  return prizes.map((prize) => {
    const won = wonById.get(prize.id) ?? 0;
    return {
      prizeId: prize.id,
      name: prize.name,
      weight: prize.weight,
      configuredShare: prize.active && totalWeight > 0 ? prize.weight / totalWeight : 0,
      won,
      actualShare: totalWon > 0 ? won / totalWon : 0,
    };
  });
}

export type DailyRow = { day: string; counts: Record<string, number> };

export async function getAnalytics(campaignId: string, days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const byName = await db.analyticsEvent.groupBy({
    by: ["name"],
    where: { campaignId, createdAt: { gte: since } },
    _count: true,
  });
  const totals = Object.fromEntries(ANALYTICS_EVENTS.map((name) => [name, 0])) as Record<string, number>;
  for (const row of byName) totals[row.name] = row._count;

  const dailyRows = await db.$queryRaw<{ day: string; name: string; count: bigint }[]>`
    SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYY-MM-DD') AS day,
           "name", COUNT(*)::bigint AS count
    FROM "AnalyticsEvent"
    WHERE "campaignId" = ${campaignId} AND "createdAt" >= ${since}
    GROUP BY 1, 2
    ORDER BY 1 DESC`;
  const dailyMap = new Map<string, Record<string, number>>();
  for (const row of dailyRows) {
    const entry = dailyMap.get(row.day) ?? {};
    entry[row.name] = Number(row.count);
    dailyMap.set(row.day, entry);
  }
  const daily: DailyRow[] = Array.from(dailyMap.entries()).map(([day, counts]) => ({ day, counts }));

  const channelRows = await db.analyticsEvent.groupBy({
    by: ["channel", "name"],
    where: { campaignId, createdAt: { gte: since }, channel: { not: null }, name: { in: ["code_issued", "spin_completed"] } },
    _count: true,
  });
  const byChannel: Record<Channel, { issued: number; spun: number }> = {
    SHOPIFY_WEB: { issued: 0, spun: 0 },
    FACEBOOK: { issued: 0, spun: 0 },
    STORE: { issued: 0, spun: 0 },
  };
  for (const row of channelRows) {
    if (!row.channel) continue;
    if (row.name === "code_issued") byChannel[row.channel].issued = row._count;
    if (row.name === "spin_completed") byChannel[row.channel].spun = row._count;
  }

  return { totals, daily, byChannel };
}
