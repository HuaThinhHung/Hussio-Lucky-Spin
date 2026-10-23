import { inject } from "vitest";

// Deterministic test secrets — never used outside tests.
process.env.DATABASE_URL = inject("databaseUrl");
process.env.PHONE_HASH_SECRET = "test-phone-hash-secret-0123456789";
process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret-0123456789";
process.env.SHOPIFY_WEBHOOK_SECRET = "test-webhook-secret";
process.env.SHOPIFY_SHOP_DOMAIN = "";
process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = "";
process.env.SHOPIFY_API_KEY = "";
process.env.SHOPIFY_API_SECRET = "";
process.env.APP_URL = "http://localhost:3000";
