import { CLIENT_ANALYTICS_EVENTS, type ClientAnalyticsEventName } from "@/lib/constants";
import { trackEvent } from "@/server/analytics";
import { getPublicCampaign } from "@/server/campaign";
import { guardPublicPost, jsonResponse, readJsonBody, stringField } from "@/server/http";

function isClientEvent(name: string): name is ClientAnalyticsEventName {
  return (CLIENT_ANALYTICS_EVENTS as readonly string[]).includes(name);
}

// POST /api/events  { name: "voucher_copied" | "shop_now_clicked", placement? }
export async function POST(request: Request) {
  const blocked = await guardPublicPost(request, "events");
  if (blocked) return blocked;

  const body = await readJsonBody(request);
  const name = stringField(body, "name", 40);
  if (!isClientEvent(name)) return jsonResponse({ ok: false }, 400);

  const campaign = await getPublicCampaign();
  await trackEvent({
    name,
    campaignId: campaign?.id ?? null,
    metadata: { placement: stringField(body, "placement", 40) || null },
  });
  return jsonResponse({ ok: true });
}
