import "server-only";
import { createAdminApiClient } from "@shopify/admin-api-client";

// Shopify Admin GraphQL access. The token never leaves the server.
//
// Two ways to authenticate (merchant chooses, see README):
//  1. SHOPIFY_ADMIN_ACCESS_TOKEN — static token (legacy custom app / shpat_...).
//  2. SHOPIFY_API_KEY + SHOPIFY_API_SECRET — Dev Dashboard app installed on the
//     HUSSIO store, using the client-credentials grant (token valid 24h,
//     refreshed automatically).

export const DEFAULT_SHOPIFY_API_VERSION = "2026-10";

export type ShopifyConfig = {
  shopDomain: string;
  apiVersion: string;
  apiKey: string;
  apiSecret: string;
  staticAccessToken: string;
  webhookSecret: string;
  writeOrderTags: boolean;
};

export function getShopifyConfig(): ShopifyConfig {
  const env = process.env;
  return {
    shopDomain: (env.SHOPIFY_SHOP_DOMAIN ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, ""),
    apiVersion: (env.SHOPIFY_API_VERSION ?? "").trim() || DEFAULT_SHOPIFY_API_VERSION,
    apiKey: (env.SHOPIFY_API_KEY ?? "").trim(),
    apiSecret: (env.SHOPIFY_API_SECRET ?? "").trim(),
    staticAccessToken: (env.SHOPIFY_ADMIN_ACCESS_TOKEN ?? "").trim(),
    webhookSecret: (env.SHOPIFY_WEBHOOK_SECRET ?? "").trim() || (env.SHOPIFY_API_SECRET ?? "").trim(),
    writeOrderTags: (env.SHOPIFY_WRITE_ORDER_TAGS ?? "").trim().toLowerCase() === "true",
  };
}

export type ShopifyAuthMode = "static_token" | "client_credentials" | "not_configured";

export function shopifyAuthMode(config: ShopifyConfig = getShopifyConfig()): ShopifyAuthMode {
  if (!config.shopDomain) return "not_configured";
  if (config.staticAccessToken) return "static_token";
  if (config.apiKey && config.apiSecret) return "client_credentials";
  return "not_configured";
}

/** False = MOCK mode (no Admin API calls are made). */
export function isShopifyConfigured(): boolean {
  return shopifyAuthMode() !== "not_configured";
}

type CachedToken = { token: string; expiresAt: number };
const tokenCache = globalThis as unknown as { __hussioShopifyToken?: CachedToken };

async function getAccessToken(config: ShopifyConfig): Promise<string> {
  if (config.staticAccessToken) return config.staticAccessToken;

  const cached = tokenCache.__hussioShopifyToken;
  if (cached && cached.expiresAt - 5 * 60_000 > Date.now()) return cached.token;

  const response = await fetch(`https://${config.shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: config.apiKey,
      client_secret: config.apiSecret,
      grant_type: "client_credentials",
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Shopify token request failed (${response.status}): ${text.slice(0, 200)}`);
  }
  const body = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("Shopify token response missing access_token");
  tokenCache.__hussioShopifyToken = {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 86_399) * 1000,
  };
  return body.access_token;
}

export class ShopifyNotConfiguredError extends Error {
  constructor() {
    super("Shopify is not configured (MOCK mode).");
  }
}

/** Runs an Admin GraphQL operation. Throws on transport or GraphQL errors. */
export async function shopifyGraphql<TData>(
  operation: string,
  variables?: Record<string, unknown>,
): Promise<TData> {
  const config = getShopifyConfig();
  if (shopifyAuthMode(config) === "not_configured") throw new ShopifyNotConfiguredError();

  const client = createAdminApiClient({
    storeDomain: config.shopDomain,
    apiVersion: config.apiVersion,
    accessToken: await getAccessToken(config),
    retries: 2,
  });
  const { data, errors } = await client.request<TData>(operation, { variables });
  if (errors) {
    const detail = errors.graphQLErrors?.map((e) => e.message).join("; ") || errors.message || "Unknown error";
    throw new Error(`Shopify GraphQL error: ${detail}`);
  }
  if (!data) throw new Error("Shopify GraphQL returned no data");
  return data;
}

export type UserError = { field?: string[] | null; message: string };

export function assertNoUserErrors(userErrors: UserError[] | null | undefined, context: string): void {
  if (userErrors && userErrors.length > 0) {
    throw new Error(`${context}: ${userErrors.map((e) => e.message).join("; ")}`);
  }
}

/** Read-only connectivity check used by the admin Settings page. */
export async function testShopifyConnection(): Promise<{ ok: true; shopName: string } | { ok: false; error: string }> {
  try {
    const data = await shopifyGraphql<{ shop: { name: string } }>(`query HussioLuckySpinShop { shop { name } }`);
    return { ok: true, shopName: data.shop.name };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
