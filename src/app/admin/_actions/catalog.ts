"use server";

// Campaign settings, prizes and gift inventory (ADMIN only).
import { revalidatePath } from "next/cache";
import Papa from "papaparse";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { fromDateTimeLocalValue, parseVndInput } from "@/lib/format";
import { logAudit } from "@/server/audit";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/server/db";
import { normalizeSize, recalcGiftPool } from "@/server/gifts";
import { sanitizeText } from "@/server/security/request";

const CAMPAIGN_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "ENDED"] as const;
const COD_MODES = ["CONFIRMED_ORDER", "PAID", "MANUAL_APPROVAL"] as const;
const NAME_MODES = ["MASKED", "FIRST_NAME", "FULL_NAME_WITH_CONSENT"] as const;
const PRIZE_TYPES = ["VOUCHER", "FREE_SHIPPING", "PRODUCT_POOL"] as const;
const GIFT_CATEGORIES = ["POLO", "TSHIRT", "SHIRT", "JACKET", "PANTS", "OTHER"] as const;

function text(formData: FormData, key: string, max = 200): string {
  return sanitizeText(String(formData.get(key) ?? ""), max);
}

function optionalInt(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  return raw === "" ? null : parseVndInput(raw);
}

function checkbox(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function revalidateCatalog() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Campaign
// ---------------------------------------------------------------------------

const campaignSchema = z.object({
  name: z.string().min(3).max(120),
  status: z.enum(CAMPAIGN_STATUSES),
  minimumOrderValue: z.number().int().min(1).max(1_000_000_000),
  codePrefix: z.string().regex(/^[A-Z]{2,12}-[A-Z0-9]{4}$/, "Tiền tố mã dạng HUSSIO-BF26"),
  codeValidityDays: z.number().int().min(1).max(365),
  voucherValidityDays: z.number().int().min(1).max(365),
  codEligibilityMode: z.enum(COD_MODES),
  winnerNameMode: z.enum(NAME_MODES),
  termsContent: z.string().min(10).max(5000),
});

export async function updateCampaignAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("ADMIN");
  const id = String(formData.get("id") ?? "");
  const parsed = campaignSchema.safeParse({
    name: text(formData, "name", 120),
    status: String(formData.get("status") ?? ""),
    minimumOrderValue: parseVndInput(String(formData.get("minimumOrderValue") ?? "")) ?? 0,
    codePrefix: text(formData, "codePrefix", 20).toUpperCase(),
    codeValidityDays: Number(formData.get("codeValidityDays")),
    voucherValidityDays: Number(formData.get("voucherValidityDays")),
    codEligibilityMode: String(formData.get("codEligibilityMode") ?? ""),
    winnerNameMode: String(formData.get("winnerNameMode") ?? ""),
    // Terms keep line breaks (one rule per line).
    termsContent: String(formData.get("termsContent") ?? "").replace(/\r\n/g, "\n").trim().slice(0, 5000),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  const startsAt = fromDateTimeLocalValue(String(formData.get("startsAt") ?? ""));
  const endsAt = fromDateTimeLocalValue(String(formData.get("endsAt") ?? ""));
  const ordersEndAt = fromDateTimeLocalValue(String(formData.get("ordersEndAt") ?? ""));
  if (startsAt && endsAt && endsAt <= startsAt) return { ok: false, message: "Ngày kết thúc phải sau ngày bắt đầu." };

  if (parsed.data.status === "ACTIVE") {
    const otherActive = await db.campaign.count({ where: { status: "ACTIVE", id: { not: id } } });
    if (otherActive > 0) return { ok: false, message: "Đang có chương trình khác ACTIVE. Tạm dừng chương trình đó trước." };
  }

  await db.campaign.update({
    where: { id },
    data: {
      ...parsed.data,
      startsAt,
      endsAt,
      ordersEndAt,
      voucherCombinesWithOrderDiscounts: checkbox(formData, "combineOrder"),
      voucherCombinesWithProductDiscounts: checkbox(formData, "combineProduct"),
      voucherCombinesWithShippingDiscounts: checkbox(formData, "combineShipping"),
    },
  });
  await logAudit({ adminUserId: admin.id, action: "campaign.update", entityType: "Campaign", entityId: id, details: { status: parsed.data.status } });
  revalidateCatalog();
  return { ok: true, message: "Đã lưu chương trình." };
}

// ---------------------------------------------------------------------------
// Prizes
// ---------------------------------------------------------------------------

const prizeSchema = z.object({
  name: z.string().min(2).max(80),
  wheelLabel: z.string().min(1).max(12),
  wheelCaption: z.string().max(14).nullable(),
  type: z.enum(PRIZE_TYPES),
  weight: z.number().int().min(0).max(100_000),
  voucherValue: z.number().int().min(0).nullable(),
  voucherMinSpend: z.number().int().min(0).nullable(),
  stockLimit: z.number().int().min(0).nullable(),
  sortOrder: z.number().int().min(0).max(999),
  giftPoolId: z.string().nullable(),
  active: z.boolean(),
});

function readPrize(formData: FormData) {
  return prizeSchema.safeParse({
    name: text(formData, "name", 80),
    wheelLabel: text(formData, "wheelLabel", 12).toUpperCase(),
    wheelCaption: text(formData, "wheelCaption", 14).toUpperCase() || null,
    type: String(formData.get("type") ?? ""),
    weight: Number(formData.get("weight") ?? 0),
    voucherValue: optionalInt(formData, "voucherValue"),
    voucherMinSpend: optionalInt(formData, "voucherMinSpend"),
    stockLimit: optionalInt(formData, "stockLimit"),
    sortOrder: Number(formData.get("sortOrder") ?? 0),
    giftPoolId: String(formData.get("giftPoolId") ?? "") || null,
    active: checkbox(formData, "active"),
  });
}

function prizeConsistencyError(data: z.infer<typeof prizeSchema>): string | null {
  if (data.type === "VOUCHER" && !data.voucherValue) return "Voucher cần giá trị giảm.";
  if (data.type === "PRODUCT_POOL" && !data.giftPoolId) return "Quà sản phẩm cần chọn kho quà.";
  return null;
}

export async function savePrizeAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("ADMIN");
  const id = String(formData.get("id") ?? "");
  const campaignId = String(formData.get("campaignId") ?? "");
  const parsed = readPrize(formData);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  const consistency = prizeConsistencyError(parsed.data);
  if (consistency) return { ok: false, message: consistency };

  const data = {
    ...parsed.data,
    giftPoolId: parsed.data.type === "PRODUCT_POOL" ? parsed.data.giftPoolId : null,
    voucherValue: parsed.data.type === "VOUCHER" ? parsed.data.voucherValue : null,
    voucherMinSpend: parsed.data.type === "PRODUCT_POOL" ? null : parsed.data.voucherMinSpend,
  };

  if (id) {
    await db.prize.update({ where: { id }, data });
    await logAudit({ adminUserId: admin.id, action: "prize.update", entityType: "Prize", entityId: id, details: { weight: data.weight, active: data.active } });
  } else {
    const created = await db.prize.create({ data: { ...data, campaignId } });
    await logAudit({ adminUserId: admin.id, action: "prize.create", entityType: "Prize", entityId: created.id });
  }
  revalidateCatalog();
  return { ok: true, message: id ? "Đã lưu." : "Đã thêm giải." };
}

// ---------------------------------------------------------------------------
// Gift inventory
// ---------------------------------------------------------------------------

const giftItemSchema = z.object({
  productName: z.string().min(2).max(120),
  size: z.string().max(10).nullable(),
  color: z.string().max(40).nullable(),
  sku: z.string().max(60).nullable(),
  quantity: z.number().int().min(0).max(100_000),
  cost: z.number().int().min(0).max(100_000_000),
  active: z.boolean(),
});

function readGiftItem(formData: FormData) {
  return giftItemSchema.safeParse({
    productName: text(formData, "productName", 120),
    size: normalizeSize(text(formData, "size", 10)),
    color: text(formData, "color", 40) || null,
    sku: text(formData, "sku", 60) || null,
    quantity: Number(formData.get("quantity") ?? 0),
    cost: parseVndInput(String(formData.get("cost") ?? "")) ?? 0,
    active: checkbox(formData, "active"),
  });
}

export async function saveGiftItemAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("ADMIN");
  const id = String(formData.get("id") ?? "");
  const parsed = readGiftItem(formData);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  let poolId: string;
  if (id) {
    const item = await db.giftItem.update({ where: { id }, data: parsed.data });
    poolId = item.giftPoolId;
    await logAudit({ adminUserId: admin.id, action: "gift_item.update", entityType: "GiftItem", entityId: id, details: { quantity: parsed.data.quantity, active: parsed.data.active } });
  } else {
    poolId = String(formData.get("giftPoolId") ?? "");
    const pool = await db.giftPool.findUnique({ where: { id: poolId } });
    if (!pool) return { ok: false, message: "Chọn kho quà." };
    const item = await db.giftItem.create({ data: { ...parsed.data, giftPoolId: pool.id, category: pool.category } });
    await logAudit({ adminUserId: admin.id, action: "gift_item.create", entityType: "GiftItem", entityId: item.id });
  }
  await recalcGiftPool(db, poolId);
  revalidateCatalog();
  return { ok: true, message: id ? "Đã lưu." : "Đã thêm sản phẩm quà." };
}

/** CSV columns: category, product_name, size, color, sku, quantity, cost */
export async function importGiftItemsAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("ADMIN");
  const campaignId = String(formData.get("campaignId") ?? "");
  const file = formData.get("file");
  const csv = file instanceof File && file.size > 0 ? await file.text() : String(formData.get("csvText") ?? "");
  if (!csv.trim()) return { ok: false, message: "Chọn file CSV." };

  const parsed = Papa.parse<Record<string, string>>(csv.trim(), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.replace(/^﻿/, "").trim().toLowerCase().replace(/[\s-]+/g, "_"),
  });
  const pools = await db.giftPool.findMany({ where: { campaignId } });
  const poolByCategory = new Map(pools.map((pool) => [pool.category as string, pool]));
  let created = 0;
  const errors: string[] = [];

  for (const [index, row] of parsed.data.entries()) {
    const category = String(row.category ?? "").trim().toUpperCase();
    if (!(GIFT_CATEGORIES as readonly string[]).includes(category)) {
      errors.push(`Dòng ${index + 2}: category không hợp lệ`);
      continue;
    }
    let pool = poolByCategory.get(category);
    if (!pool) {
      pool = await db.giftPool.create({
        data: { campaignId, category: category as (typeof GIFT_CATEGORIES)[number], name: category },
      });
      poolByCategory.set(category, pool);
    }
    const item = giftItemSchema.safeParse({
      productName: sanitizeText(row.product_name ?? "", 120),
      size: normalizeSize(row.size),
      color: sanitizeText(row.color ?? "", 40) || null,
      sku: sanitizeText(row.sku ?? "", 60) || null,
      quantity: parseVndInput(row.quantity) ?? 0,
      cost: parseVndInput(row.cost) ?? 0,
      active: true,
    });
    if (!item.success) {
      errors.push(`Dòng ${index + 2}: ${item.error.issues[0]?.message}`);
      continue;
    }
    await db.giftItem.create({ data: { ...item.data, giftPoolId: pool.id, category: pool.category } });
    created += 1;
  }
  for (const pool of poolByCategory.values()) await recalcGiftPool(db, pool.id);
  await logAudit({ adminUserId: admin.id, action: "gift_item.import", entityType: "GiftItem", details: { created, errors: errors.length } });
  revalidateCatalog();
  return {
    ok: created > 0,
    message: `Đã thêm ${created} dòng quà.${errors.length ? ` Lỗi: ${errors.slice(0, 5).join("; ")}` : ""}`,
  };
}
