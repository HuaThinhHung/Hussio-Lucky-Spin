// Creates an admin / staff account, or resets the password of an existing one.
//
//   npm run admin:create -- staff@hussio.com "Nhân viên Cửa hàng" STAFF
//   npm run admin:create -- admin@hussio.com "HUSSIO Admin" ADMIN --reset
//
// The password is read from NEW_ADMIN_PASSWORD, otherwise a random one is
// generated and printed once.
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../src/server/auth/password";

async function main() {
  const [emailArg, nameArg, roleArg] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const reset = process.argv.includes("--reset");
  const email = emailArg?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error('Usage: npm run admin:create -- <email> "<name>" [ADMIN|STAFF] [--reset]');
  }
  const role = roleArg?.toUpperCase() === "ADMIN" ? "ADMIN" : "STAFF";
  const password = process.env.NEW_ADMIN_PASSWORD?.trim() || randomBytes(12).toString("base64url");
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing && !reset) throw new Error(`${email} already exists. Add --reset to set a new password.`);
    const passwordHash = await hashPassword(password);
    if (existing) {
      await prisma.adminUser.update({ where: { email }, data: { passwordHash, active: true } });
      await prisma.adminSession.deleteMany({ where: { adminUserId: existing.id } });
      console.log(`✔ Password reset for ${email}`);
    } else {
      await prisma.adminUser.create({ data: { email, name: nameArg?.trim() || email, role, passwordHash } });
      console.log(`✔ Created ${role} ${email}`);
    }
    if (!process.env.NEW_ADMIN_PASSWORD) console.log(`  Password (shown once): ${password}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
