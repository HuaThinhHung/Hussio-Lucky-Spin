import "server-only";
import type { WinnerStatus } from "@/generated/prisma/enums";
import { logAudit } from "@/server/audit";
import { db } from "@/server/db";
import { recalcGiftPool, releaseGiftItem } from "@/server/gifts";
import { scheduleVoucherDeactivation } from "@/server/vouchers";

export type RewardActionResult = { ok: true } | { ok: false; message: string };

/**
 * Voids a reward: winner -> VOID, spin -> VOID, unredeemed voucher -> VOID,
 * allocated gift unit and prize quota returned to stock. The spin history is kept.
 * Rewards already fulfilled / vouchers already redeemed are not voided.
 */
export async function voidReward(
  spinId: string,
  reason: string,
  actor: { adminUserId: string | null },
): Promise<RewardActionResult> {
  let deactivateDiscountId: string | null = null;

  const result = await db.$transaction(async (tx): Promise<RewardActionResult> => {
    await tx.$queryRaw`SELECT "id" FROM "Spin" WHERE "id" = ${spinId} FOR UPDATE`;
    // Sequential lookups (no nested include) keep a single query in flight on the transaction connection.
    const spin = await tx.spin.findUnique({ where: { id: spinId } });
    const winner = spin ? await tx.winner.findUnique({ where: { spinId } }) : null;
    if (!spin || !winner) return { ok: false, message: "Không tìm thấy lượt quay." };
    const voucher = await tx.voucher.findUnique({ where: { spinId } });
    const prize = await tx.prize.findUniqueOrThrow({ where: { id: spin.prizeId } });
    if (winner.status === "VOID") return { ok: true };
    if (winner.status === "FULFILLED") {
      return { ok: false, message: "Quà đã được trao — không thể huỷ." };
    }
    if (voucher?.status === "REDEEMED") {
      return { ok: false, message: "Voucher đã được khách sử dụng — không thể huỷ." };
    }

    const now = new Date();
    await tx.winner.update({
      where: { spinId },
      data: { status: "VOID", voidedAt: now, voidReason: reason.slice(0, 300) },
    });
    await tx.spin.update({ where: { id: spinId }, data: { status: "VOID" } });

    if (voucher && voucher.status === "ISSUED") {
      await tx.voucher.update({ where: { id: voucher.id }, data: { status: "VOID" } });
      deactivateDiscountId = voucher.shopifyDiscountId;
    }
    if (spin.giftItemId) await releaseGiftItem(tx, spin.giftItemId);
    await tx.$executeRaw`
      UPDATE "Prize" SET "stockUsed" = GREATEST("stockUsed" - 1, 0), "updatedAt" = now() WHERE "id" = ${spin.prizeId}`;
    if (prize.giftPoolId) await recalcGiftPool(tx, prize.giftPoolId);

    await logAudit(
      { adminUserId: actor.adminUserId, action: "reward.void", entityType: "Spin", entityId: spinId, details: { reason } },
      tx,
    );
    return { ok: true };
  });

  if (result.ok) scheduleVoucherDeactivation(deactivateDiscountId);
  return result;
}

const ALLOWED_TRANSITIONS: Record<WinnerStatus, WinnerStatus[]> = {
  WON: ["CONFIRMED", "FULFILLED"],
  CONFIRMED: ["FULFILLED", "WON"],
  FULFILLED: [],
  VOID: [],
};

/** MARK CONFIRMED / MARK FULFILLED from the winners admin. */
export async function setWinnerStatus(
  spinId: string,
  next: Extract<WinnerStatus, "CONFIRMED" | "FULFILLED" | "WON">,
  actor: { adminUserId: string },
  adminNote?: string,
): Promise<RewardActionResult> {
  const winner = await db.winner.findUnique({ where: { spinId } });
  if (!winner) return { ok: false, message: "Không tìm thấy người trúng." };
  if (!ALLOWED_TRANSITIONS[winner.status].includes(next)) {
    return { ok: false, message: `Không thể chuyển trạng thái từ ${winner.status} sang ${next}.` };
  }
  const now = new Date();
  await db.winner.update({
    where: { spinId },
    data: {
      status: next,
      confirmedAt: next === "CONFIRMED" ? now : winner.confirmedAt,
      fulfilledAt: next === "FULFILLED" ? now : null,
      adminNote: adminNote?.trim() ? adminNote.trim().slice(0, 500) : winner.adminNote,
    },
  });
  await logAudit({
    adminUserId: actor.adminUserId,
    action: `winner.${next.toLowerCase()}`,
    entityType: "Spin",
    entityId: spinId,
  });
  return { ok: true };
}

/**
 * Order cancelled / fully refunded: unused codes -> CANCELLED,
 * used codes keep their spin history but the reward is voided (if not redeemed).
 */
export async function cancelOrderRewards(
  params: { channel: "SHOPIFY_WEB" | "FACEBOOK" | "STORE"; orderReference: string; reason: string },
  actor: { adminUserId: string | null },
): Promise<{ cancelledCodes: number; voidedRewards: number; skipped: number }> {
  const codes = await db.luckyCode.findMany({
    where: { channel: params.channel, orderReference: params.orderReference },
    include: { spin: true },
  });
  let cancelledCodes = 0;
  let voidedRewards = 0;
  let skipped = 0;

  for (const code of codes) {
    if (code.status === "ACTIVE" || code.status === "PENDING" || code.status === "EXPIRED") {
      await db.luckyCode.update({
        where: { id: code.id },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: params.reason.slice(0, 300) },
      });
      cancelledCodes += 1;
    } else if (code.status === "USED" && code.spin) {
      const result = await voidReward(code.spin.id, params.reason, actor);
      if (result.ok) voidedRewards += 1;
      else skipped += 1;
    }
  }
  return { cancelledCodes, voidedRewards, skipped };
}
