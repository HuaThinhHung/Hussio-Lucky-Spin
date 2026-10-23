"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/server/db";
import { setWinnerStatus, voidReward } from "@/server/rewards";
import { sanitizeText } from "@/server/security/request";
import { syncVoucherToShopify } from "@/server/vouchers";

function refresh() {
  revalidatePath("/admin/winners");
  revalidatePath("/admin/vouchers");
  revalidatePath("/admin");
}

export async function markWinnerAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("STAFF");
  const spinId = String(formData.get("spinId") ?? "");
  const next = String(formData.get("status") ?? "");
  if (next !== "CONFIRMED" && next !== "FULFILLED" && next !== "WON") return { ok: false, message: "Trạng thái không hợp lệ." };
  const result = await setWinnerStatus(spinId, next, { adminUserId: admin.id }, sanitizeText(String(formData.get("adminNote") ?? ""), 500));
  refresh();
  return result.ok ? { ok: true, message: "Đã cập nhật." } : { ok: false, message: result.message };
}

export async function voidRewardAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("ADMIN");
  const spinId = String(formData.get("spinId") ?? "");
  const reason = sanitizeText(String(formData.get("reason") ?? ""), 300) || "Huỷ bởi admin";
  const result = await voidReward(spinId, reason, { adminUserId: admin.id });
  refresh();
  revalidatePath("/");
  return result.ok ? { ok: true, message: "Đã huỷ phần thưởng." } : { ok: false, message: result.message };
}

export async function syncVoucherAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin("ADMIN");
  const voucherId = String(formData.get("voucherId") ?? "");
  const exists = await db.voucher.findUnique({ where: { id: voucherId }, select: { id: true } });
  if (!exists) return { ok: false, message: "Không tìm thấy voucher." };
  const voucher = await syncVoucherToShopify(voucherId);
  refresh();
  if (voucher.syncStatus === "SYNCED") return { ok: true, message: "Đã tạo mã trên Shopify." };
  if (voucher.syncStatus === "SKIPPED") return { ok: false, message: "Chưa kết nối Shopify (MOCK mode)." };
  return { ok: false, message: voucher.syncError ?? "Đồng bộ thất bại." };
}
