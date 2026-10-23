import "server-only";
import type { Channel } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import type { AnalyticsEventName } from "@/lib/constants";
import { db, type DbOrTx } from "@/server/db";

export type TrackEventInput = {
  name: AnalyticsEventName;
  campaignId?: string | null;
  channel?: Channel | null;
  prizeId?: string | null;
  luckyCodeId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

/** Stores an analytics event in the database. Never throws (tracking must not break flows). */
export async function trackEvent(input: TrackEventInput, client: DbOrTx = db): Promise<void> {
  try {
    await client.analyticsEvent.create({
      data: {
        name: input.name,
        campaignId: input.campaignId ?? null,
        channel: input.channel ?? null,
        prizeId: input.prizeId ?? null,
        luckyCodeId: input.luckyCodeId ?? null,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    console.error("[analytics] failed to track", input.name, error);
  }
}
