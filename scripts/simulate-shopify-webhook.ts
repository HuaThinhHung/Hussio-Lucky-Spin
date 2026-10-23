// Sends a signed fake Shopify order webhook to a LOCAL instance (MOCK testing).
//
//   npm run shopify:simulate -- paid 1450000            -> orders/paid, prepaid, 1.450.000đ
//   npm run shopify:simulate -- create 1350000 cod      -> orders/create, COD
//   npm run shopify:simulate -- cancelled 1350000       -> orders/cancelled for the same order
//
// Options: --order=#1042  --phone=0912345678  --name="Hứa Hưng"  --url=http://localhost:3000
import "dotenv/config";
import { createHmac, randomUUID } from "node:crypto";

function option(name: string, fallback: string): string {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : fallback;
}

async function main() {
  const [kind = "paid", amount = "1450000", payment = "prepaid"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const baseUrl = option("url", process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseUrl)) {
    throw new Error(`Refusing to send fake webhooks to ${baseUrl} — local testing only.`);
  }
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_API_SECRET;
  if (!secret) throw new Error("Set SHOPIFY_WEBHOOK_SECRET in .env (any value works locally).");

  const orderName = option("order", "#9001");
  const numericId = Number(orderName.replace(/\D/g, "")) || 9001;
  const topic = kind === "create" ? "orders/create" : kind === "cancelled" ? "orders/cancelled" : "orders/paid";
  const isCod = payment === "cod";

  const payload = {
    id: numericId,
    admin_graphql_api_id: `gid://shopify/Order/${numericId}`,
    name: orderName,
    created_at: new Date().toISOString(),
    cancelled_at: kind === "cancelled" ? new Date().toISOString() : null,
    confirmed: true,
    currency: "VND",
    subtotal_price: amount,
    total_price: String(Number(amount) + 30000),
    financial_status: isCod && kind !== "paid" ? "pending" : "paid",
    payment_gateway_names: [isCod ? "Cash on Delivery (COD)" : "VNPAY"],
    shipping_address: {
      name: option("name", "Khách Thử Webhook"),
      phone: option("phone", "0900000002"),
      province: "Hồ Chí Minh",
      city: "Quận 1",
    },
  };
  const body = JSON.stringify(payload);
  const hmac = createHmac("sha256", secret).update(body).digest("base64");

  const response = await fetch(`${baseUrl}/api/webhooks/shopify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Topic": topic,
      "X-Shopify-Hmac-Sha256": hmac,
      "X-Shopify-Webhook-Id": randomUUID(),
      "X-Shopify-Shop-Domain": process.env.SHOPIFY_SHOP_DOMAIN || "hussio-dev.myshopify.com",
    },
    body,
  });
  console.log(response.status, await response.text());
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
