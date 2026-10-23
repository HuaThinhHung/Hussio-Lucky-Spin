import "server-only";
import Papa from "papaparse";
import { z } from "zod";
import type { Campaign, LuckyCode } from "@/generated/prisma/client";
import type { Channel, LuckyCodeStatus } from "@/generated/prisma/enums";
import { generateLuckyCode } from "@/lib/codes";
import { formatVnd, parseVndInput } from "@/lib/format";
import { hashPhone, normalizeVnPhone, phoneHint } from "@/lib/phone";
import { trackEvent } from "@/server/analytics";
import { logAudit } from "@/server/audit";
import { getIssuingCampaign } from "@/server/campaign";
import { db, isUniqueViolation } from "@/server/db";
import { sanitizeText } from "@/server/security/request";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 8;
export const MAX_IMPORT_ROWS = 2000;

export const CHANNELS = ["SHOPIFY_WEB", "FACEBOOK", "STORE"] as const satisfies readonly Channel[];

export type IssueErrorCode =
  | "NO_CAMPAIGN"
  | "CAMPAIGN_ENDED"
  | "BELOW_MINIMUM"
  | "INVALID_PHONE"
  | "INVALID_INPUT"
  | "DUPLICATE_ORDER";

export type IssueResult =
  | { ok: true; luckyCode: LuckyCode }
  | { ok: false; error: IssueErrorCode; message: string; existingCode?: string };

export const issueCodeSchema = z.object({
  customerName: z.string().trim().min(2, "Nhập tên khách hàng").max(80),
  phone: z.string().trim().min(1, "Nhập số điện thoại").max(20),
  orderReference: z.string().trim().min(1, "Nhập mã đơn / mã bill").max(64),
  orderValue: z.number().int().nonnegative(),
  channel: z.enum(CHANNELS),
  customerCity: z.string().trim().max(60).optional().nullable(),
});
export type IssueCodeInput = z.infer<typeof issueCodeSchema>;

/** One canonical form per order so the same order can't get two codes. */
export function normalizeOrderReference(channel: Channel, raw: string): string {
  const cleaned = sanitizeText(raw, 64).toUpperCase().replace(/\s+/g, "");
  if (channel === "SHOPIFY_WEB") return `#${cleaned.replace(/^#+/, "")}`;
  return cleaned;
}

/** Accepts SHOPIFY_WEB / website / web / shopify, FACEBOOK / fb, STORE / cửa hàng / shop. */
export function parseChannel(raw: string): Channel | null {
  const value = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (["SHOPIFY_WEB", "WEBSITE", "WEB", "SHOPIFY", "SHOPIFY_WEBSITE"].includes(value)) return "SHOPIFY_WEB";
  if (["FACEBOOK", "FB", "MESSENGER", "FANPAGE"].includes(value)) return "FACEBOOK";
  if (["STORE", "CUA_HANG", "CUAHANG", "SHOP", "OFFLINE"].includes(value)) return "STORE";
  return null;
}

type IssueOptions = {
  campaign?: Campaign | null;
  source: "admin" | "csv" | "shopify_webhook";
  createdById?: string | null;
  status?: Extract<LuckyCodeStatus, "ACTIVE" | "PENDING">;
  shopifyOrderId?: string | null;
  now?: Date;
};

/** Issues one lucky code for an eligible order (all channels go through here). */
export async function issueLuckyCode(rawInput: IssueCodeInput, options: IssueOptions): Promise<IssueResult> {
  const parsed = issueCodeSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "INVALID_INPUT", message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  }
  const input = parsed.data;
  const now = options.now ?? new Date();

  const campaign = options.campaign === undefined ? await getIssuingCampaign() : options.campaign;
  if (!campaign) return { ok: false, error: "NO_CAMPAIGN", message: "Chưa có chương trình nào để phát mã." };
  if (campaign.status === "ENDED") {
    return { ok: false, error: "CAMPAIGN_ENDED", message: "Chương trình đã kết thúc, không thể phát thêm mã." };
  }
  if (input.orderValue < campaign.minimumOrderValue) {
    return {
      ok: false,
      error: "BELOW_MINIMUM",
      message: `Giá trị đơn ${formatVnd(input.orderValue)} chưa đạt tối thiểu ${formatVnd(campaign.minimumOrderValue)}.`,
    };
  }

  const phone = normalizeVnPhone(input.phone);
  if (!phone) return { ok: false, error: "INVALID_PHONE", message: "Số điện thoại không hợp lệ." };

  const orderReference = normalizeOrderReference(input.channel, input.orderReference);
  const duplicate = () =>
    db.luckyCode.findUnique({
      where: { campaignId_channel_orderReference: { campaignId: campaign.id, channel: input.channel, orderReference } },
      select: { code: true },
    });
  const existing = await duplicate();
  if (existing) {
    return {
      ok: false,
      error: "DUPLICATE_ORDER",
      message: `Đơn ${orderReference} đã được cấp mã ${existing.code}.`,
      existingCode: existing.code,
    };
  }

  const expiresAt = new Date(now.getTime() + campaign.codeValidityDays * DAY_MS);
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    try {
      const luckyCode = await db.luckyCode.create({
        data: {
          code: generateLuckyCode(campaign.codePrefix),
          campaignId: campaign.id,
          channel: input.channel,
          orderReference,
          customerName: sanitizeText(input.customerName, 80),
          customerCity: input.customerCity ? sanitizeText(input.customerCity, 60) || null : null,
          phoneHash: hashPhone(phone),
          phoneHint: phoneHint(phone),
          orderValue: input.orderValue,
          status: options.status ?? "ACTIVE",
          issuedAt: now,
          expiresAt,
          shopifyOrderId: options.shopifyOrderId ?? null,
          source: options.source,
          createdById: options.createdById ?? null,
        },
      });
      await trackEvent({
        name: "code_issued",
        campaignId: campaign.id,
        channel: input.channel,
        luckyCodeId: luckyCode.id,
        metadata: { source: options.source },
      });
      if (options.createdById) {
        await logAudit({
          adminUserId: options.createdById,
          action: "code.issue",
          entityType: "LuckyCode",
          entityId: luckyCode.id,
          details: { channel: input.channel, orderReference, source: options.source },
        });
      }
      return { ok: true, luckyCode };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Either the order was issued concurrently, or (extremely rarely) the random code collided.
      const raced = await duplicate();
      if (raced) {
        return {
          ok: false,
          error: "DUPLICATE_ORDER",
          message: `Đơn ${orderReference} đã được cấp mã ${raced.code}.`,
          existingCode: raced.code,
        };
      }
    }
  }
  throw new Error("Could not generate a unique lucky code");
}

// ---------------------------------------------------------------------------
// CSV bulk import: customer_name, phone, order_reference, order_value, channel
// ---------------------------------------------------------------------------

export const IMPORT_COLUMNS = ["customer_name", "phone", "order_reference", "order_value", "channel"] as const;

export type ImportRowResult = {
  row: number;
  orderReference: string;
  customerName: string;
  ok: boolean;
  code?: string;
  message: string;
};

export type ImportSummary = {
  created: number;
  failed: number;
  rows: ImportRowResult[];
  error?: string;
};

function normalizeHeader(header: string): string {
  return header.replace(/^﻿/, "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export async function importLuckyCodesCsv(
  csvText: string,
  options: { createdById: string | null; defaultChannel?: Channel | null },
): Promise<ImportSummary> {
  const parsed = Papa.parse<Record<string, string>>(csvText.trim(), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
  });
  const headers = parsed.meta.fields ?? [];
  const required = IMPORT_COLUMNS.filter((column) => column !== "channel" || !options.defaultChannel);
  const missing = required.filter((column) => !headers.includes(column));
  if (missing.length > 0) {
    return { created: 0, failed: 0, rows: [], error: `Thiếu cột: ${missing.join(", ")}` };
  }
  if (parsed.data.length > MAX_IMPORT_ROWS) {
    return { created: 0, failed: 0, rows: [], error: `Tối đa ${MAX_IMPORT_ROWS} dòng mỗi lần import.` };
  }

  const campaign = await getIssuingCampaign();
  const rows: ImportRowResult[] = [];
  for (const [index, record] of parsed.data.entries()) {
    const rowNumber = index + 2; // header is row 1
    const customerName = (record.customer_name ?? "").trim();
    const orderReference = (record.order_reference ?? "").trim();
    const channel = record.channel ? parseChannel(record.channel) : (options.defaultChannel ?? null);
    const orderValue = parseVndInput(record.order_value);

    if (!channel) {
      rows.push({ row: rowNumber, orderReference, customerName, ok: false, message: "Kênh không hợp lệ (SHOPIFY_WEB / FACEBOOK / STORE)" });
      continue;
    }
    if (orderValue === null) {
      rows.push({ row: rowNumber, orderReference, customerName, ok: false, message: "Giá trị đơn không hợp lệ" });
      continue;
    }

    const result = await issueLuckyCode(
      { customerName, phone: record.phone ?? "", orderReference, orderValue, channel, customerCity: record.city ?? null },
      { campaign, source: "csv", createdById: options.createdById },
    );
    rows.push(
      result.ok
        ? { row: rowNumber, orderReference, customerName, ok: true, code: result.luckyCode.code, message: "Đã tạo mã" }
        : { row: rowNumber, orderReference, customerName, ok: false, message: result.message },
    );
  }

  const created = rows.filter((row) => row.ok).length;
  if (options.createdById) {
    await logAudit({
      adminUserId: options.createdById,
      action: "code.bulk_import",
      entityType: "LuckyCode",
      details: { created, failed: rows.length - created },
    });
  }
  return { created, failed: rows.length - created, rows };
}

// ---------------------------------------------------------------------------
// Admin code actions
// ---------------------------------------------------------------------------

export async function cancelLuckyCode(
  codeId: string,
  reason: string,
  adminUserId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const updated = await db.luckyCode.updateMany({
    where: { id: codeId, status: { in: ["ACTIVE", "PENDING", "EXPIRED"] } },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: sanitizeText(reason, 300) || "Huỷ bởi admin" },
  });
  if (updated.count === 0) return { ok: false, message: "Chỉ huỷ được mã chưa quay." };
  await logAudit({ adminUserId, action: "code.cancel", entityType: "LuckyCode", entityId: codeId, details: { reason } });
  return { ok: true };
}

export async function approvePendingCode(
  codeId: string,
  adminUserId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const updated = await db.luckyCode.updateMany({
    where: { id: codeId, status: "PENDING" },
    data: { status: "ACTIVE" },
  });
  if (updated.count === 0) return { ok: false, message: "Mã không ở trạng thái chờ duyệt." };
  await logAudit({ adminUserId, action: "code.approve", entityType: "LuckyCode", entityId: codeId });
  return { ok: true };
}

export async function unlockLuckyCode(codeId: string, adminUserId: string): Promise<void> {
  await db.luckyCode.update({ where: { id: codeId }, data: { failedAttempts: 0, lockedUntil: null } });
  await logAudit({ adminUserId, action: "code.unlock", entityType: "LuckyCode", entityId: codeId });
}
