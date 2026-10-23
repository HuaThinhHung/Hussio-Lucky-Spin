"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { parseVndInput } from "@/lib/format";
import { requireAdmin } from "@/server/auth/session";
import {
  approvePendingCode,
  cancelLuckyCode,
  CHANNELS,
  importLuckyCodesCsv,
  issueLuckyCode,
  parseChannel,
  unlockLuckyCode,
} from "@/server/lucky-codes";

const MAX_CSV_BYTES = 1_000_000;

export async function createCodeAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("STAFF");
  const channelRaw = String(formData.get("channel") ?? "");
  const channel = (CHANNELS as readonly string[]).includes(channelRaw) ? (channelRaw as (typeof CHANNELS)[number]) : null;
  const orderValue = parseVndInput(String(formData.get("orderValue") ?? ""));
  if (!channel) return { ok: false, message: "Chọn kênh bán hàng." };
  if (orderValue === null) return { ok: false, message: "Nhập giá trị đơn hàng." };

  const result = await issueLuckyCode(
    {
      customerName: String(formData.get("customerName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      orderReference: String(formData.get("orderReference") ?? ""),
      orderValue,
      channel,
      customerCity: String(formData.get("customerCity") ?? "") || null,
    },
    { source: "admin", createdById: admin.id },
  );

  if (!result.ok) {
    return {
      ok: false,
      message: result.message,
      data: result.existingCode ? { existingCode: result.existingCode } : undefined,
    };
  }
  revalidatePath("/admin/codes");
  revalidatePath("/admin");
  return {
    ok: true,
    message: "Đã tạo mã quay.",
    data: {
      code: result.luckyCode.code,
      customerName: result.luckyCode.customerName,
      orderReference: result.luckyCode.orderReference,
    },
  };
}

export async function importCodesAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("STAFF");
  const file = formData.get("file");
  let csv = String(formData.get("csvText") ?? "");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_CSV_BYTES) return { ok: false, message: "File quá lớn (tối đa 1MB)." };
    csv = await file.text();
  }
  if (!csv.trim()) return { ok: false, message: "Chọn file CSV hoặc dán nội dung CSV." };

  const defaultChannel = parseChannel(String(formData.get("defaultChannel") ?? ""));
  const summary = await importLuckyCodesCsv(csv, { createdById: admin.id, defaultChannel });
  if (summary.error) return { ok: false, message: summary.error };

  revalidatePath("/admin/codes");
  revalidatePath("/admin");
  return {
    ok: summary.created > 0,
    message: `Đã tạo ${summary.created} mã, ${summary.failed} dòng lỗi.`,
    data: { report: JSON.stringify(summary.rows) },
  };
}

export async function cancelCodeAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("STAFF");
  const result = await cancelLuckyCode(String(formData.get("id") ?? ""), String(formData.get("reason") ?? ""), admin.id);
  revalidatePath("/admin/codes");
  return result.ok ? { ok: true, message: "Đã huỷ mã." } : { ok: false, message: result.message };
}

export async function approveCodeAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("STAFF");
  const result = await approvePendingCode(String(formData.get("id") ?? ""), admin.id);
  revalidatePath("/admin/codes");
  return result.ok ? { ok: true, message: "Đã duyệt mã." } : { ok: false, message: result.message };
}

export async function unlockCodeAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("STAFF");
  await unlockLuckyCode(String(formData.get("id") ?? ""), admin.id);
  revalidatePath("/admin/codes");
  return { ok: true, message: "Đã mở khoá mã." };
}
