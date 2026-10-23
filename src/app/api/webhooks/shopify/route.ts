import { createHash } from "node:crypto";
import { jsonResponse } from "@/server/http";
import { getShopifyConfig } from "@/server/shopify/client";
import { processShopifyWebhook, verifyShopifyHmac } from "@/server/shopify/webhooks";

// POST /api/webhooks/shopify
// Topics: orders/create, orders/paid, orders/updated, orders/cancelled, refunds/create.
// 1. Verify HMAC on the RAW body  2. De-duplicate by X-Shopify-Webhook-Id
// 3. Process idempotently  4. 5xx only on unexpected errors so Shopify retries.
export async function POST(request: Request) {
  const config = getShopifyConfig();
  if (!config.webhookSecret) {
    return jsonResponse({ ok: false, error: "Webhook secret not configured" }, 503);
  }

  const rawBody = await request.text();
  const hmac = request.headers.get("x-shopify-hmac-sha256");
  if (!verifyShopifyHmac(rawBody, hmac, config.webhookSecret)) {
    return jsonResponse({ ok: false, error: "Invalid HMAC" }, 401);
  }

  const shopDomain = request.headers.get("x-shopify-shop-domain")?.toLowerCase() ?? null;
  if (config.shopDomain && shopDomain && shopDomain !== config.shopDomain) {
    return jsonResponse({ ok: false, error: "Unknown shop" }, 401);
  }

  const topic = request.headers.get("x-shopify-topic") ?? "unknown";
  const webhookId =
    request.headers.get("x-shopify-webhook-id") ??
    request.headers.get("x-shopify-event-id") ??
    createHash("sha256").update(`${topic}:${rawBody}`).digest("hex");

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  try {
    const { duplicate, outcome } = await processShopifyWebhook({ topic, webhookId, shopDomain, payload });
    return jsonResponse({ ok: true, duplicate, status: outcome.status, note: outcome.note });
  } catch (error) {
    console.error("[webhooks/shopify]", topic, webhookId, error);
    return jsonResponse({ ok: false }, 500);
  }
}
