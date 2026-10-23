import "server-only";
import type { Campaign, Prize } from "@/generated/prisma/client";
import type { WheelSegmentView } from "@/lib/lucky-types";
import { db, type DbOrTx } from "@/server/db";

export type CampaignAvailability = "ACTIVE" | "NOT_STARTED" | "PAUSED" | "ENDED";

/** Whether customers can spin right now. */
export function campaignAvailability(
  campaign: Pick<Campaign, "status" | "startsAt" | "endsAt">,
  now: Date = new Date(),
): CampaignAvailability {
  if (campaign.status === "ENDED") return "ENDED";
  if (campaign.endsAt && campaign.endsAt.getTime() <= now.getTime()) return "ENDED";
  if (campaign.status === "PAUSED") return "PAUSED";
  if (campaign.status === "DRAFT") return "NOT_STARTED";
  if (campaign.startsAt && campaign.startsAt.getTime() > now.getTime()) return "NOT_STARTED";
  return "ACTIVE";
}

/** Campaign shown on the public site: the active one, else the most recent non-ended one, else the latest. */
export async function getPublicCampaign(client: DbOrTx = db): Promise<Campaign | null> {
  const active = await client.campaign.findFirst({
    where: { status: "ACTIVE" },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
  });
  if (active) return active;
  const upcoming = await client.campaign.findFirst({
    where: { status: { in: ["DRAFT", "PAUSED"] } },
    orderBy: { createdAt: "desc" },
  });
  if (upcoming) return upcoming;
  return client.campaign.findFirst({ orderBy: { createdAt: "desc" } });
}

/** Campaign that new codes are issued into (admin): active, else draft/paused. Never an ended one. */
export async function getIssuingCampaign(client: DbOrTx = db): Promise<Campaign | null> {
  const active = await client.campaign.findFirst({
    where: { status: "ACTIVE" },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
  });
  if (active) return active;
  return client.campaign.findFirst({
    where: { status: { in: ["DRAFT", "PAUSED"] } },
    orderBy: { createdAt: "desc" },
  });
}

/** Active prizes in wheel order. The array index IS the segment index. */
export async function getWheelPrizes(campaignId: string, client: DbOrTx = db): Promise<Prize[]> {
  return client.prize.findMany({
    where: { campaignId, active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
}

export function toWheelSegments(prizes: Prize[]): WheelSegmentView[] {
  return prizes.map((prize) => ({
    id: prize.id,
    name: prize.name,
    label: prize.wheelLabel,
    caption: prize.wheelCaption,
    type: prize.type,
  }));
}

export function termsToList(termsContent: string): string[] {
  return termsContent
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s*•\-–]+/, "").trim())
    .filter(Boolean);
}
