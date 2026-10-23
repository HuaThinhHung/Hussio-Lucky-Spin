// Default data for HUSSIO Lucky Spin — Black Friday 2026.
// Source: Google Sheet "Hussio - Black Friday - 2026", tab "7.Gifts list"
// (category totals: 172 products, 16.282.700đ cost) + the campaign brief.
import type { PrismaClient } from "../src/generated/prisma/client";
import type { CampaignStatus, GiftCategory, PrizeType } from "../src/generated/prisma/enums";
import { DEFAULT_TERMS } from "../src/lib/constants";

export const CAMPAIGN_SLUG = "black-friday-2026";

export const DEFAULT_CAMPAIGN = {
  name: "HUSSIO BLACK FRIDAY LUCKY SPIN 2026",
  slug: CAMPAIGN_SLUG,
  status: "DRAFT" as const,
  minimumOrderValue: 1_300_000,
  currency: "VND",
  codePrefix: "HUSSIO-BF26",
  // Black Friday sales window 01/11 – 30/11 (Vietnam time). Spinning stays open
  // one more week so COD / store customers who bought on 30/11 can still spin.
  startsAt: new Date("2026-11-01T00:00:00+07:00"),
  ordersEndAt: new Date("2026-11-30T23:59:59+07:00"),
  endsAt: new Date("2026-12-07T23:59:59+07:00"),
  codeValidityDays: 30,
  voucherValidityDays: 30,
  termsContent: DEFAULT_TERMS,
};

/** Gift pools per the gift sheet: quantity + total cost (giá vốn) per category. */
export const DEFAULT_GIFT_POOLS: {
  category: GiftCategory;
  name: string;
  productName: string;
  quantity: number;
  totalCost: number;
}[] = [
  { category: "POLO", name: "Áo Polo", productName: "Áo Polo HUSSIO (quà tặng)", quantity: 83, totalCost: 7_546_200 },
  { category: "TSHIRT", name: "Áo thun", productName: "Áo thun HUSSIO (quà tặng)", quantity: 40, totalCost: 2_975_000 },
  { category: "SHIRT", name: "Sơ mi", productName: "Sơ mi HUSSIO (quà tặng)", quantity: 30, totalCost: 2_658_500 },
  { category: "JACKET", name: "Áo khoác", productName: "Áo khoác HUSSIO (quà tặng)", quantity: 12, totalCost: 1_857_000 },
  { category: "PANTS", name: "Quần dài", productName: "Quần dài HUSSIO (quà tặng)", quantity: 7, totalCost: 1_246_000 },
];

type PrizeSeed = {
  name: string;
  wheelLabel: string;
  wheelCaption: string;
  type: PrizeType;
  weight: number;
  voucherValue?: number;
  voucherMinSpend?: number;
  pool?: GiftCategory;
  sortOrder: number;
};

/**
 * 9 wheel prizes (weights from the brief: 85% voucher/freeship, 15% physical).
 * sortOrder interleaves vouchers and products so the wheel reads balanced.
 */
export const DEFAULT_PRIZES: PrizeSeed[] = [
  { name: "Voucher 30K", wheelLabel: "30K", wheelCaption: "VOUCHER", type: "VOUCHER", weight: 30, voucherValue: 30_000, voucherMinSpend: 399_000, sortOrder: 1 },
  { name: "Áo Polo HUSSIO", wheelLabel: "POLO", wheelCaption: "ÁO", type: "PRODUCT_POOL", weight: 6, pool: "POLO", sortOrder: 2 },
  { name: "Voucher 50K", wheelLabel: "50K", wheelCaption: "VOUCHER", type: "VOUCHER", weight: 25, voucherValue: 50_000, voucherMinSpend: 599_000, sortOrder: 3 },
  { name: "Áo thun HUSSIO", wheelLabel: "ÁO THUN", wheelCaption: "HUSSIO", type: "PRODUCT_POOL", weight: 4, pool: "TSHIRT", sortOrder: 4 },
  { name: "Voucher 100K", wheelLabel: "100K", wheelCaption: "VOUCHER", type: "VOUCHER", weight: 15, voucherValue: 100_000, voucherMinSpend: 899_000, sortOrder: 5 },
  { name: "Sơ mi HUSSIO", wheelLabel: "SƠ MI", wheelCaption: "HUSSIO", type: "PRODUCT_POOL", weight: 3, pool: "SHIRT", sortOrder: 6 },
  { name: "Freeship đơn tiếp theo", wheelLabel: "FREESHIP", wheelCaption: "ĐƠN TIẾP", type: "FREE_SHIPPING", weight: 15, sortOrder: 7 },
  { name: "Áo khoác HUSSIO", wheelLabel: "KHOÁC", wheelCaption: "ÁO", type: "PRODUCT_POOL", weight: 1, pool: "JACKET", sortOrder: 8 },
  { name: "Quần HUSSIO", wheelLabel: "QUẦN", wheelCaption: "HUSSIO", type: "PRODUCT_POOL", weight: 1, pool: "PANTS", sortOrder: 9 },
];

export type CampaignSeedOverrides = Partial<Omit<typeof DEFAULT_CAMPAIGN, "status">> & { status?: CampaignStatus };

/** Creates (or completes) the default campaign, gift pools, gift items and prizes. Idempotent. */
export async function seedCampaign(prisma: PrismaClient, overrides: CampaignSeedOverrides = {}) {
  const data = { ...DEFAULT_CAMPAIGN, ...overrides };
  const campaign = await prisma.campaign.upsert({
    where: { slug: data.slug },
    update: {},
    create: data,
  });

  const pools = new Map<GiftCategory, string>();
  for (const seed of DEFAULT_GIFT_POOLS) {
    const pool = await prisma.giftPool.upsert({
      where: { campaignId_category: { campaignId: campaign.id, category: seed.category } },
      update: {},
      create: {
        campaignId: campaign.id,
        name: seed.name,
        category: seed.category,
        quantityTotal: seed.quantity,
        quantityRemaining: seed.quantity,
      },
    });
    pools.set(seed.category, pool.id);

    const itemCount = await prisma.giftItem.count({ where: { giftPoolId: pool.id } });
    if (itemCount === 0) {
      // The sheet only gives category totals (no size breakdown) -> one line per
      // category with the average unit cost. Import the exact SKU list in
      // Admin > Gift Inventory when sizes are known.
      await prisma.giftItem.create({
        data: {
          giftPoolId: pool.id,
          productName: seed.productName,
          category: seed.category,
          size: null,
          quantity: seed.quantity,
          cost: Math.round(seed.totalCost / seed.quantity),
        },
      });
    }
  }

  const prizeCount = await prisma.prize.count({ where: { campaignId: campaign.id } });
  if (prizeCount === 0) {
    for (const prize of DEFAULT_PRIZES) {
      await prisma.prize.create({
        data: {
          campaignId: campaign.id,
          name: prize.name,
          wheelLabel: prize.wheelLabel,
          wheelCaption: prize.wheelCaption,
          type: prize.type,
          weight: prize.weight,
          voucherValue: prize.voucherValue ?? null,
          voucherMinSpend: prize.voucherMinSpend ?? null,
          giftPoolId: prize.pool ? (pools.get(prize.pool) ?? null) : null,
          sortOrder: prize.sortOrder,
        },
      });
    }
  }

  return campaign;
}
