// Registers the order webhooks on the HUSSIO Shopify store via Admin GraphQL.
//
//   npm run shopify:webhooks                 -> dry run (prints what would be created)
//   npm run shopify:webhooks -- --confirm    -> creates missing subscriptions
//
// ⚠️ --confirm writes to the LIVE store configured in SHOPIFY_SHOP_DOMAIN.
// Run it only after the merchant approves going live.
import "dotenv/config";
import { shopifyGraphql, shopifyAuthMode } from "../src/server/shopify/client";

const TOPICS = ["ORDERS_CREATE", "ORDERS_PAID", "ORDERS_UPDATED", "ORDERS_CANCELLED", "REFUNDS_CREATE"] as const;

const LIST = `#graphql
  query HussioLuckySpinWebhooks {
    webhookSubscriptions(first: 100) { nodes { id topic uri } }
  }
`;

const CREATE = `#graphql
  mutation HussioLuckySpinWebhookCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
      webhookSubscription { id topic uri }
      userErrors { field message }
    }
  }
`;

async function main() {
  const confirm = process.argv.includes("--confirm");
  if (shopifyAuthMode() === "not_configured") {
    throw new Error("Shopify is not configured. Fill SHOPIFY_SHOP_DOMAIN + credentials in .env first.");
  }
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  if (!appUrl.startsWith("https://")) throw new Error("APP_URL must be the public https URL (e.g. https://quay.hussio-vn.com).");
  const uri = `${appUrl}/api/webhooks/shopify`;

  const existing = await shopifyGraphql<{ webhookSubscriptions: { nodes: { id: string; topic: string; uri: string }[] } }>(LIST);
  const already = new Set(existing.webhookSubscriptions.nodes.filter((n) => n.uri === uri).map((n) => n.topic));

  for (const topic of TOPICS) {
    if (already.has(topic)) {
      console.log(`✔ ${topic} already -> ${uri}`);
      continue;
    }
    if (!confirm) {
      console.log(`• would create ${topic} -> ${uri}`);
      continue;
    }
    const result = await shopifyGraphql<{
      webhookSubscriptionCreate: { webhookSubscription: { id: string } | null; userErrors: { message: string }[] };
    }>(CREATE, { topic, webhookSubscription: { uri } });
    const errors = result.webhookSubscriptionCreate.userErrors;
    if (errors.length) console.error(`✖ ${topic}: ${errors.map((e) => e.message).join("; ")}`);
    else console.log(`✔ created ${topic} (${result.webhookSubscriptionCreate.webhookSubscription?.id})`);
  }
  if (!confirm) console.log("\nDry run only. Re-run with --confirm to create the subscriptions.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
