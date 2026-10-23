import "dotenv/config";
import { db } from "../src/server/db";
import { getIssuingCampaign } from "../src/server/campaign";
async function main() {
 const campaign = await getIssuingCampaign();
 if (!campaign) throw new Error("Chưa có chương trình");
 await db.$transaction(async tx => {
   await tx.$queryRaw`SELECT "id" FROM "Campaign" WHERE "id" = ${campaign.id} FOR UPDATE`;
   const gifts = ["Vớ", "Mũ", "Thắt lưng"];
   for (const [i, name] of gifts.entries()) {
     if (!await tx.prize.findFirst({ where: { campaignId: campaign.id, name } })) {
       await tx.prize.create({ data: { campaignId: campaign.id, name, wheelLabel: name.toUpperCase(), wheelCaption: "QUÀ TẶNG", type: "PRODUCT_POOL", weight: 5, stockLimit: 50, sortOrder: 10 + i } });
     }
   }
   for (const [i, amount] of [10000, 20000, 30000, 40000, 50000].entries()) {
     if (!await tx.prize.findFirst({ where: { campaignId: campaign.id, type: "VOUCHER", voucherValue: amount } })) {
       await tx.prize.create({ data: { campaignId: campaign.id, name: `Voucher ${amount / 1000}K`, wheelLabel: `-${amount / 1000}K`, wheelCaption: "VOUCHER", type: "VOUCHER", weight: 10, voucherValue: amount, sortOrder: 13 + i } });
     }
   }
 });
 console.log("Đã bổ sung quà và voucher. Quà phụ kiện: tạm đặt 50 phần/loại, trọng số 5.");
}
main().finally(() => db.$disconnect());
