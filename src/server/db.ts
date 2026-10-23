import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

export type Db = PrismaClient;
export type Tx = Prisma.TransactionClient;
/** Accepts either the root client or an interactive-transaction client. */
export type DbOrTx = PrismaClient | Prisma.TransactionClient;

const globalForPrisma = globalThis as unknown as { __hussioPrisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure it.");
  }
  const adapter = new PrismaPg({ connectionString, max: Number(process.env.DATABASE_POOL_MAX ?? 10) });
  return new PrismaClient({ adapter });
}

function getClient(): PrismaClient {
  if (!globalForPrisma.__hussioPrisma) {
    globalForPrisma.__hussioPrisma = createClient();
  }
  return globalForPrisma.__hussioPrisma;
}

/**
 * Lazily-initialised Prisma client. Creating it on first use (instead of at
 * import time) keeps `next build` and tests from needing a database just to
 * load modules.
 */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export async function disconnectDb(): Promise<void> {
  if (globalForPrisma.__hussioPrisma) {
    await globalForPrisma.__hussioPrisma.$disconnect();
    globalForPrisma.__hussioPrisma = undefined;
  }
}

/** Unique-constraint violation (P2002). */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
