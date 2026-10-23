import { db } from "@/server/db";
import { jsonResponse } from "@/server/http";
import { shopifyAuthMode } from "@/server/shopify/client";

// GET /api/health — uptime check (no secrets in the response).
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return jsonResponse({ ok: true, database: "up", shopify: shopifyAuthMode() });
  } catch {
    return jsonResponse({ ok: false, database: "down" }, 503);
  }
}
