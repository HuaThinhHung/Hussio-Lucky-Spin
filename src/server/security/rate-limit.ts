import "server-only";
import { randomInt } from "node:crypto";
import { db } from "@/server/db";

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  retryAfterSeconds: number;
};

/**
 * Fixed-window rate limiter stored in PostgreSQL, so it works across
 * serverless instances (an in-memory limiter would not on Vercel).
 */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const rows = await db.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "windowStart")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."windowStart" < now() - (${windowSeconds}::int * interval '1 second') THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "RateLimitBucket"."windowStart" < now() - (${windowSeconds}::int * interval '1 second') THEN now()
        ELSE "RateLimitBucket"."windowStart"
      END
    RETURNING "count", "windowStart"`;

  const row = rows[0];
  const count = Number(row?.count ?? 1);
  const windowStart = row?.windowStart ? new Date(row.windowStart) : new Date();
  const elapsed = Math.floor((Date.now() - windowStart.getTime()) / 1000);

  // Occasionally clean up old buckets (~1% of calls).
  if (randomInt(100) === 0) void pruneRateLimits();

  return {
    allowed: count <= limit,
    count,
    retryAfterSeconds: Math.max(1, windowSeconds - elapsed),
  };
}

async function pruneRateLimits(): Promise<void> {
  try {
    await db.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "windowStart" < now() - interval '1 day'`;
  } catch {
    // best effort
  }
}

export const RATE_LIMITS = {
  validate: { limit: 30, windowSeconds: 10 * 60 },
  spin: { limit: 20, windowSeconds: 10 * 60 },
  confirm: { limit: 20, windowSeconds: 10 * 60 },
  events: { limit: 60, windowSeconds: 60 },
  adminLogin: { limit: 8, windowSeconds: 15 * 60 },
} as const;
