import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AdminUser } from "@/generated/prisma/client";
import type { AdminRole } from "@/generated/prisma/enums";
import { db } from "@/server/db";

// Admin sessions: random 256-bit token in an httpOnly cookie; only an HMAC of
// the token is stored in the database (revocable, not forgeable from a DB leak).

export const SESSION_COOKIE = "hls_admin";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export type AdminIdentity = Pick<AdminUser, "id" | "email" | "name" | "role">;

function sessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("ADMIN_SESSION_SECRET must be set (at least 16 characters).");
  }
  return secret;
}

function hashToken(token: string): string {
  return createHmac("sha256", sessionSecret()).update(token).digest("hex");
}

export async function createAdminSession(adminUserId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.adminSession.create({ data: { tokenHash: hashToken(token), adminUserId, expiresAt } });
  await db.adminUser.update({ where: { id: adminUserId }, data: { lastLoginAt: new Date() } });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getAdminSession(): Promise<AdminIdentity | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { adminUser: { select: { id: true, email: true, name: true, role: true, active: true } } },
  });
  if (!session || session.expiresAt.getTime() <= Date.now() || !session.adminUser.active) return null;
  const { active: _active, ...identity } = session.adminUser;
  void _active;
  return identity;
}

export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await db.adminSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  cookieStore.delete(SESSION_COOKIE);
}

/** Use at the top of every admin page and server action. */
export async function requireAdmin(minimumRole: AdminRole = "STAFF"): Promise<AdminIdentity> {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");
  if (minimumRole === "ADMIN" && admin.role !== "ADMIN") redirect("/admin?forbidden=1");
  return admin;
}
