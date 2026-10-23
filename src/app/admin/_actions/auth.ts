"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { logAudit } from "@/server/audit";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createAdminSession, destroyAdminSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { consumeRateLimit, RATE_LIMITS } from "@/server/security/rate-limit";
import { getClientIp, hashIp } from "@/server/security/request";

let dummyHash: Promise<string> | null = null;

export async function loginAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 120);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  if (!email || !password) return { ok: false, message: "Nhập email và mật khẩu." };

  const ipKey = hashIp(getClientIp(await headers()));
  const { limit, windowSeconds } = RATE_LIMITS.adminLogin;
  const byIp = await consumeRateLimit(`login:ip:${ipKey}`, limit, windowSeconds);
  const byEmail = await consumeRateLimit(`login:email:${email}`, limit, windowSeconds);
  if (!byIp.allowed || !byEmail.allowed) {
    return { ok: false, message: "Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút." };
  }

  const user = await db.adminUser.findUnique({ where: { email } });
  // Always run scrypt so response time doesn't reveal whether the email exists.
  dummyHash ??= hashPassword("hussio-dummy-password");
  const valid = user?.active
    ? await verifyPassword(password, user.passwordHash)
    : (await verifyPassword(password, await dummyHash)) && false;
  if (!user || !valid) return { ok: false, message: "Email hoặc mật khẩu không đúng." };

  await createAdminSession(user.id);
  await logAudit({ adminUserId: user.id, action: "admin.login", entityType: "AdminUser", entityId: user.id });
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await destroyAdminSession();
  redirect("/admin/login");
}
