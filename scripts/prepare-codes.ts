import "dotenv/config";
import { randomUUID } from "node:crypto";
import { generateLuckyCode } from "../src/lib/codes";
import { db } from "../src/server/db";
import { getIssuingCampaign } from "../src/server/campaign";
async function main() {
 const campaign = await getIssuingCampaign();
 if (!campaign) throw new Error("Chưa có chương trình");
 await db.$transaction(async tx => {
  await tx.$queryRaw`SELECT "id" FROM "Campaign" WHERE "id" = ${campaign.id} FOR UPDATE`;
  const count = await tx.luckyCode.count({ where: { campaignId: campaign.id, source: "simple_batch" } });
  const remaining = Math.max(0, 500 - count);
  if (remaining) await tx.luckyCode.createMany({ data: Array.from({ length: remaining }, () => ({ code: generateLuckyCode(), campaignId: campaign.id,
   channel: "STORE" as const, orderReference: `RESERVED-${randomUUID()}`, customerName: "Khách HUSSIO", phoneHash: "", orderValue: 0,
   status: "PENDING" as const, source: "simple_batch" })) });
  console.log(`Lô 500 mã đã sẵn sàng; tạo thêm ${remaining} mã chưa cấp.`);
 });
}
main().finally(() => db.$disconnect());
