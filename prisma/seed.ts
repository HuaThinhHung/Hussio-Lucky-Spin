// npm run db:seed
// Seeds the Black Friday 2026 campaign, prizes, gift inventory and the first admin.
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/server/auth/password";
import { seedCampaign } from "./seed-data";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const campaign = await seedCampaign(prisma);
    console.log(`✔ Campaign "${campaign.name}" (${campaign.status})`);

    const prizes = await prisma.prize.count({ where: { campaignId: campaign.id } });
    const giftUnits = await prisma.giftItem.aggregate({
      where: { giftPool: { campaignId: campaign.id } },
      _sum: { quantity: true },
    });
    console.log(`✔ ${prizes} prizes, ${giftUnits._sum.quantity ?? 0} gift units in stock`);

    const email = (process.env.ADMIN_EMAIL ?? "admin@hussio.com").trim().toLowerCase();
    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) {
      console.log(`✔ Admin ${email} already exists (password unchanged)`);
    } else {
      const provided = process.env.ADMIN_PASSWORD?.trim();
      const password = provided || randomBytes(12).toString("base64url");
      await prisma.adminUser.create({
        data: { email, name: "HUSSIO Admin", role: "ADMIN", passwordHash: await hashPassword(password) },
      });
      console.log(`✔ Admin created: ${email}`);
      if (!provided) {
        console.log(`  Generated password (shown once, change it in Admin > Settings): ${password}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
