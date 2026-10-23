"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { logAudit } from "@/server/audit";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "@/server/auth/password";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/server/db";
import { testShopifyConnection } from "@/server/shopify/client";
import { sanitizeText } from "@/server/security/request";

const newUserSchema = z.object({
  email: z.email("Email không hợp lệ").max(120),
  name: z.string().min(2, "Nhập tên").max(80),
  role: z.enum(["ADMIN", "STAFF"]),
  password: z.string().min(MIN_PASSWORD_LENGTH, `Mật khẩu tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`).max(200),
});

export async function createAdminUserAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("ADMIN");
  const parsed = newUserSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    name: sanitizeText(String(formData.get("name") ?? ""), 80),
    role: String(formData.get("role") ?? "STAFF"),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  const exists = await db.adminUser.findUnique({ where: { email: parsed.data.email } });
  if (exists) return { ok: false, message: "Email đã tồn tại." };
  const user = await db.adminUser.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role,
      passwordHash: await hashPassword(parsed.data.password),
    },
  });
  await logAudit({ adminUserId: admin.id, action: "admin_user.create", entityType: "AdminUser", entityId: user.id, details: { role: user.role } });
  revalidatePath("/admin/settings");
  return { ok: true, message: `Đã tạo tài khoản ${user.email}.` };
}

export async function toggleAdminUserAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("ADMIN");
  const id = String(formData.get("id") ?? "");
  if (id === admin.id) return { ok: false, message: "Không thể tự khoá tài khoản của mình." };
  const user = await db.adminUser.findUnique({ where: { id } });
  if (!user) return { ok: false, message: "Không tìm thấy tài khoản." };
  await db.adminUser.update({ where: { id }, data: { active: !user.active } });
  if (user.active) await db.adminSession.deleteMany({ where: { adminUserId: id } });
  await logAudit({ adminUserId: admin.id, action: user.active ? "admin_user.disable" : "admin_user.enable", entityType: "AdminUser", entityId: id });
  revalidatePath("/admin/settings");
  return { ok: true, message: user.active ? "Đã khoá tài khoản." : "Đã mở tài khoản." };
}

export async function changePasswordAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("STAFF");
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  if (next.length < MIN_PASSWORD_LENGTH) return { ok: false, message: `Mật khẩu mới tối thiểu ${MIN_PASSWORD_LENGTH} ký tự.` };
  const user = await db.adminUser.findUniqueOrThrow({ where: { id: admin.id } });
  if (!(await verifyPassword(current, user.passwordHash))) return { ok: false, message: "Mật khẩu hiện tại không đúng." };
  await db.adminUser.update({ where: { id: admin.id }, data: { passwordHash: await hashPassword(next) } });
  await logAudit({ adminUserId: admin.id, action: "admin_user.change_password", entityType: "AdminUser", entityId: admin.id });
  return { ok: true, message: "Đã đổi mật khẩu." };
}

export async function testShopifyAction(): Promise<ActionResult> {
  await requireAdmin("ADMIN");
  const result = await testShopifyConnection();
  return result.ok
    ? { ok: true, message: `Kết nối thành công: ${result.shopName}` }
    : { ok: false, message: `Không kết nối được: ${result.error}` };
}
