import "server-only";
import { RECENT_WINNERS_LIMIT } from "@/lib/constants";
import type { PublicWinner } from "@/lib/lucky-types";
import { publicDisplayName } from "@/lib/name-mask";
import { db } from "@/server/db";

/**
 * Public "NGƯỜI MAY MẮN GẦN ĐÂY" feed. Real winners only, no PII:
 * never phone, email, order reference or address — only a masked name,
 * the city, the prize and the time.
 */
export async function getRecentWinners(limit: number = RECENT_WINNERS_LIMIT): Promise<PublicWinner[]> {
  const winners = await db.winner.findMany({
    where: { status: { not: "VOID" } },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 30),
    select: {
      id: true,
      city: true,
      consentFullName: true,
      createdAt: true,
      prize: { select: { name: true, type: true } },
      campaign: { select: { winnerNameMode: true } },
      spin: { select: { luckyCode: { select: { customerName: true } } } },
    },
  });

  return winners.map((winner) => ({
    id: winner.id,
    displayName: publicDisplayName(
      winner.spin.luckyCode.customerName,
      winner.campaign.winnerNameMode,
      winner.consentFullName,
    ),
    city: winner.city,
    prizeName: winner.prize.name,
    prizeType: winner.prize.type,
    createdAt: winner.createdAt.toISOString(),
  }));
}
