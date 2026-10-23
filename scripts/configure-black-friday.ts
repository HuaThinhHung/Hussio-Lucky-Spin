import "dotenv/config";
import { db } from "../src/server/db";
import { getIssuingCampaign } from "../src/server/campaign";
async function main() {
 const campaign = await getIssuingCampaign(); if (!campaign) throw new Error("No campaign");
 await db.$transaction(async tx => {
  await tx.$queryRaw`SELECT "id" FROM "Campaign" WHERE "id" = ${campaign.id} FOR UPDATE`;
  const prizes = await tx.prize.findMany({ where: { campaignId: campaign.id } });
  const gifts = ["Vớ", "Mũ", "Thắt lưng"];
  const amounts = [10000,20000,30000,40000,50000];
  const selected = [...gifts.map(name => prizes.find(p => p.name === name)), ...amounts.map(value => prizes.find(p => p.type === "VOUCHER" && p.voucherValue === value))];
  if (selected.some(p => !p)) throw new Error("Missing campaign prizes");
  await tx.prize.updateMany({ where: { campaignId: campaign.id }, data: { active: false } });
  for (const [index, prize] of selected.entries()) if (prize) await tx.prize.update({ where: { id: prize.id }, data: { active: true, sortOrder: index, wheelLabel: prize.type === "VOUCHER" ? `-${prize.voucherValue! / 1000}K` : prize.name.toUpperCase(), wheelCaption: prize.type === "VOUCHER" ? "VOUCHER" : "QUÀ TẶNG" } });
 });
 console.log("Eight Black Friday prizes configured; historical records preserved.");
}
main().finally(() => db.$disconnect());
