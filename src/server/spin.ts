import "server-only";
import { randomInt as cryptoRandomInt } from "node:crypto";
import type { Campaign, LuckyCode, Prize } from "@/generated/prisma/client";
import type { LuckyCodeStatus } from "@/generated/prisma/enums";
import { WINNER_STATUS_LABELS } from "@/lib/constants";
import { isPlausibleCode, normalizeCodeInput } from "@/lib/codes";
import {
  luckyError,
  type ConfirmRewardResponse,
  type LuckyError,
  type LuckyErrorCode,
  type SpinResponse,
  type SpinResultView,
  type ValidateResponse,
} from "@/lib/lucky-types";
import { givenName } from "@/lib/name-mask";
import { prizeHeadline } from "@/lib/prize-display";
import { pickWeighted, type RandomIntFn } from "@/lib/weighted-random";
import { trackEvent } from "@/server/analytics";
import { campaignAvailability, getWheelPrizes } from "@/server/campaign";
import { db, isUniqueViolation, type DbOrTx, type Tx } from "@/server/db";
import {
  allocateGiftItem,
  normalizeSize,
  poolsWithStock,
  recalcGiftPool,
  releaseGiftItem,
  sizeOptionsForPool,
} from "@/server/gifts";
import { createVoucherRecord, scheduleVoucherSync } from "@/server/vouchers";

// ---------------------------------------------------------------------------
// The spin engine. Every prize decision happens here, server-side, with
// crypto.randomInt inside a database transaction. The browser only receives
// the resulting segment index to animate to.
// ---------------------------------------------------------------------------

export type SpinDeps = {
  /** Injected only by tests; production always uses crypto.randomInt. */
  randomInt?: RandomIntFn;
  now?: () => Date;
};

type LuckyCodeWithCampaign = LuckyCode & { campaign: Campaign };

class SpinFailure extends Error {
  constructor(readonly code: LuckyErrorCode) {
    super(code);
  }
}

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

// ---------------------------------------------------------------------------
// Code + phone verification
// ---------------------------------------------------------------------------

async function verifyCode(rawCode: string): Promise<{ ok: true; luckyCode: LuckyCodeWithCampaign } | LuckyError> {
  const code = normalizeCodeInput(rawCode ?? "");
  if (!isPlausibleCode(code)) return luckyError("INVALID_CODE");
  const luckyCode = await db.luckyCode.findUnique({ where: { code }, include: { campaign: true } });
  return luckyCode ? { ok: true, luckyCode } : luckyError("INVALID_CODE");
}

function statusErrorCode(status: LuckyCodeStatus): LuckyErrorCode {
  switch (status) {
    case "PENDING":
      return "PENDING_APPROVAL";
    case "CANCELLED":
      return "CANCELLED";
    case "EXPIRED":
      return "EXPIRED";
    case "USED":
      return "USED";
    default:
      return "INVALID_CODE";
  }
}

/** Checks an ACTIVE-looking code can spin right now (expiry + campaign window). */
async function gateSpinnableCode(luckyCode: LuckyCodeWithCampaign, now: Date): Promise<LuckyErrorCode | null> {
  if (luckyCode.status !== "ACTIVE") return statusErrorCode(luckyCode.status);
  if (luckyCode.expiresAt && luckyCode.expiresAt.getTime() <= now.getTime()) {
    await db.luckyCode.updateMany({ where: { id: luckyCode.id, status: "ACTIVE" }, data: { status: "EXPIRED" } });
    return "EXPIRED";
  }
  const availability = campaignAvailability(luckyCode.campaign, now);
  if (availability === "ENDED") return "CAMPAIGN_ENDED";
  if (availability === "PAUSED") return "CAMPAIGN_PAUSED";
  if (availability === "NOT_STARTED") return "CAMPAIGN_NOT_STARTED";
  return null;
}

// ---------------------------------------------------------------------------
// Prize availability + draw
// ---------------------------------------------------------------------------

type Candidate = { prize: Prize; segmentIndex: number };

async function availableCandidates(client: DbOrTx, wheel: Prize[]): Promise<Candidate[]> {
  const poolIds = wheel
    .filter((prize) => prize.type === "PRODUCT_POOL" && prize.giftPoolId)
    .map((prize) => prize.giftPoolId as string);
  const stockedPools = await poolsWithStock(client, poolIds);

  return wheel
    .map((prize, segmentIndex) => ({ prize, segmentIndex }))
    .filter(({ prize }) => {
      if (!prize.active || prize.weight <= 0) return false;
      if (prize.stockLimit !== null && prize.stockUsed >= prize.stockLimit) return false;
      if (prize.type === "PRODUCT_POOL") return prize.giftPoolId ? stockedPools.has(prize.giftPoolId) : prize.stockLimit !== null;
      return true;
    });
}

type Draw = Candidate & { randomValue: number; totalWeight: number; giftItemId: string | null };

/**
 * Weighted secure draw among available prizes, reserving quota and gift stock.
 * If a reservation loses a race (last unit taken concurrently) the prize is
 * excluded and the draw is repeated.
 */
async function drawPrize(tx: Tx, wheel: Prize[], randomInt: RandomIntFn): Promise<Draw | null> {
  let candidates = await availableCandidates(tx, wheel);

  while (candidates.length > 0) {
    const pick = pickWeighted(
      candidates.map((candidate) => ({ item: candidate, weight: candidate.prize.weight })),
      randomInt,
    );
    if (!pick) return null;
    const { prize } = pick.item;
    const exclude = () => {
      candidates = candidates.filter((candidate) => candidate.prize.id !== prize.id);
    };

    const quotaReserved = await tx.$executeRaw`
      UPDATE "Prize" SET "stockUsed" = "stockUsed" + 1, "updatedAt" = now()
      WHERE "id" = ${prize.id} AND ("stockLimit" IS NULL OR "stockUsed" < "stockLimit")`;
    if (quotaReserved !== 1) {
      exclude();
      continue;
    }

    let giftItemId: string | null = null;
    if (prize.type === "PRODUCT_POOL" && prize.giftPoolId) {
      const item = prize.giftPoolId ? await allocateGiftItem(tx, prize.giftPoolId, randomInt) : null;
      if (!item) {
        await tx.$executeRaw`
          UPDATE "Prize" SET "stockUsed" = GREATEST("stockUsed" - 1, 0) WHERE "id" = ${prize.id}`;
        exclude();
        continue;
      }
      giftItemId = item.id;
    }

    return {
      ...pick.item,
      randomValue: pick.randomValue,
      totalWeight: pick.totalWeight,
      giftItemId,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Result view (what the customer sees)
// ---------------------------------------------------------------------------

export async function getSpinResultView(spinId: string, client: DbOrTx = db): Promise<SpinResultView> {
  const spin = await client.spin.findUniqueOrThrow({
    where: { id: spinId },
    include: { prize: true, voucher: true, winner: true, giftItem: true },
  });
  const wheel = await getWheelPrizes(spin.campaignId, client);
  const currentIndex = wheel.findIndex((prize) => prize.id === spin.prizeId);
  const segmentCount = Math.max(wheel.length, 1);
  const segmentIndex = currentIndex >= 0 ? currentIndex : Math.min(spin.segmentIndex, segmentCount - 1);
  const rewardStatus = spin.winner?.status ?? (spin.status === "VOID" ? "VOID" : "WON");

  let product: SpinResultView["product"] = null;
  if (spin.prize.type === "PRODUCT_POOL" && spin.prize.giftPoolId) {
    const sizes = await sizeOptionsForPool(client, spin.prize.giftPoolId, spin.giftItem);
    product = {
      sizeOptions: sizes.options,
      sizeStockKnown: sizes.stockKnown,
      sizePreference: spin.winner?.sizePreference ?? null,
      customerConfirmed: Boolean(spin.winner?.customerConfirmedAt),
    };
  }

  const voucher = spin.voucher;
  return {
    spinId: spin.id,
    prizeId: spin.prizeId,
    prizeName: spin.prize.name,
    prizeHeadline: prizeHeadline(spin.prize),
    prizeType: spin.prize.type,
    segmentIndex,
    segmentCount,
    spunAt: spin.createdAt.toISOString(),
    rewardStatus,
    rewardStatusLabel: WINNER_STATUS_LABELS[rewardStatus],
    voucher:
      voucher && (voucher.type === "VOUCHER" || voucher.type === "FREE_SHIPPING")
        ? {
            code: voucher.code,
            type: voucher.type,
            value: voucher.value,
            minimumSpend: voucher.minimumSpend,
            expiresAt: voucher.expiresAt.toISOString(),
            status: voucher.status,
          }
        : null,
    product,
  };
}

async function existingResult(luckyCodeId: string): Promise<SpinResultView | null> {
  const spin = await db.spin.findUnique({ where: { luckyCodeId }, select: { id: true } });
  return spin ? getSpinResultView(spin.id) : null;
}

// ---------------------------------------------------------------------------
// Public operations
// ---------------------------------------------------------------------------

/** Step 1: customer enters code + phone. */
export async function validateLuckyCode(
  input: { code: string; phone?: string },
  deps: SpinDeps = {},
): Promise<ValidateResponse> {
  const now = deps.now?.() ?? new Date();
  const check = await verifyCode(input.code);
  if (!check.ok) return check;
  const { luckyCode } = check;

  if (luckyCode.status === "USED") {
    const result = await existingResult(luckyCode.id);
    return result ? { ok: true, state: "ALREADY_SPUN", result } : luckyError("USED");
  }

  const gate = await gateSpinnableCode(luckyCode, now);
  if (gate) return luckyError(gate);

  const wheel = await getWheelPrizes(luckyCode.campaignId);
  if ((await availableCandidates(db, wheel)).length === 0) return luckyError("NO_PRIZES");

  await trackEvent({
    name: "code_validated",
    campaignId: luckyCode.campaignId,
    channel: luckyCode.channel,
    luckyCodeId: luckyCode.id,
  });

  return {
    ok: true,
    state: "READY",
    customerName: givenName(luckyCode.customerName),
    spinsAvailable: 1,
    expiresAt: luckyCode.expiresAt?.toISOString() ?? null,
    askNameConsent: luckyCode.campaign.winnerNameMode === "FULL_NAME_WITH_CONSENT",
  };
}

/**
 * Step 2: spin. Safe against double clicks, refreshes, multiple tabs and
 * concurrent requests: the LuckyCode row is locked (SELECT … FOR UPDATE) and
 * Spin.luckyCodeId is UNIQUE. A repeated request returns the SAME result.
 */
export async function performSpin(
  input: { code: string; phone?: string; consentFullName?: boolean },
  deps: SpinDeps = {},
): Promise<SpinResponse> {
  const randomInt = deps.randomInt ?? cryptoRandomInt;
  const now = deps.now?.() ?? new Date();

  const check = await verifyCode(input.code);
  if (!check.ok) return check;
  const { luckyCode } = check;

  if (luckyCode.status === "USED") {
    const result = await existingResult(luckyCode.id);
    return result ? { ok: true, repeated: true, result } : luckyError("USED");
  }
  const gate = await gateSpinnableCode(luckyCode, now);
  if (gate) return luckyError(gate);

  await trackEvent({
    name: "spin_started",
    campaignId: luckyCode.campaignId,
    channel: luckyCode.channel,
    luckyCodeId: luckyCode.id,
  });

  let outcome: { spinId: string; voucherId: string | null; repeated: boolean };
  try {
    outcome = await db.$transaction(async (tx) => {
      // 1. Lock the code row. Concurrent requests for the same code wait here.
      const locked = await tx.$queryRaw<{ status: LuckyCodeStatus }[]>`
        SELECT "status" FROM "LuckyCode" WHERE "id" = ${luckyCode.id} FOR UPDATE`;
      const status = locked[0]?.status;
      if (status === "USED") {
        const existing = await tx.spin.findUnique({ where: { luckyCodeId: luckyCode.id }, select: { id: true } });
        if (existing) return { spinId: existing.id, voucherId: null, repeated: true };
        throw new SpinFailure("USED");
      }
      if (status !== "ACTIVE") throw new SpinFailure(statusErrorCode(status ?? "CANCELLED"));

      // 2. Secure weighted draw among prizes that still have stock/quota.
      const wheel = await getWheelPrizes(luckyCode.campaignId, tx);
      const draw = await drawPrize(tx, wheel, randomInt);
      if (!draw) throw new SpinFailure("NO_PRIZES");

      // 3. Persist spin, reward and winner; burn the code.
      const spin = await tx.spin.create({
        data: {
          campaignId: luckyCode.campaignId,
          luckyCodeId: luckyCode.id,
          prizeId: draw.prize.id,
          giftItemId: draw.giftItemId,
          segmentIndex: draw.segmentIndex,
          randomValue: draw.randomValue,
          totalWeight: draw.totalWeight,
        },
      });

      let voucherId: string | null = null;
      if (draw.prize.type === "VOUCHER" || draw.prize.type === "FREE_SHIPPING") {
        const voucher = await createVoucherRecord(tx, {
          campaign: luckyCode.campaign,
          prize: draw.prize,
          spinId: spin.id,
          now,
        });
        voucherId = voucher.id;
      }

      await tx.winner.create({
        data: {
          campaignId: luckyCode.campaignId,
          spinId: spin.id,
          prizeId: draw.prize.id,
          city: luckyCode.customerCity,
          consentFullName:
            Boolean(input.consentFullName) && luckyCode.campaign.winnerNameMode === "FULL_NAME_WITH_CONSENT",
        },
      });

      await tx.luckyCode.update({ where: { id: luckyCode.id }, data: { status: "USED", usedAt: now } });

      if (draw.prize.giftPoolId && draw.giftItemId) await recalcGiftPool(tx, draw.prize.giftPoolId);

      const eventBase = {
        campaignId: luckyCode.campaignId,
        channel: luckyCode.channel,
        luckyCodeId: luckyCode.id,
        prizeId: draw.prize.id,
      };
      await trackEvent({ ...eventBase, name: "spin_completed" }, tx);
      await trackEvent({ ...eventBase, name: "prize_won", metadata: { prizeType: draw.prize.type } }, tx);

      return { spinId: spin.id, voucherId, repeated: false };
    }, TRANSACTION_OPTIONS);
  } catch (error) {
    if (error instanceof SpinFailure) {
      if (error.code === "USED") {
        const result = await existingResult(luckyCode.id);
        if (result) return { ok: true, repeated: true, result };
      }
      return luckyError(error.code);
    }
    if (isUniqueViolation(error)) {
      // Another request created the spin first: return that result.
      const result = await existingResult(luckyCode.id);
      if (result) return { ok: true, repeated: true, result };
    }
    throw error;
  }

  if (outcome.voucherId && !outcome.repeated) scheduleVoucherSync(outcome.voucherId);
  const result = await getSpinResultView(outcome.spinId);
  return { ok: true, repeated: outcome.repeated, result };
}

/** Step 3 (product prizes): customer picks a size / confirms contact note. */
export async function confirmProductReward(
  input: { code: string; phone?: string; size: string; note?: string | null },
  deps: SpinDeps = {},
): Promise<ConfirmRewardResponse> {
  const randomInt = deps.randomInt ?? cryptoRandomInt;
  const now = deps.now?.() ?? new Date();
  const check = await verifyCode(input.code);
  if (!check.ok) return check;
  const { luckyCode } = check;

  const size = normalizeSize(input.size);
  if (!size) return luckyError("VALIDATION");

  const spin = await db.spin.findUnique({
    where: { luckyCodeId: luckyCode.id },
    include: { prize: true, winner: true, giftItem: true },
  });
  if (!spin || !spin.winner) return luckyError("VALIDATION");
  if (spin.prize.type !== "PRODUCT_POOL") return luckyError("NOT_PRODUCT_PRIZE");
  if (spin.winner.status !== "WON") return luckyError("REWARD_LOCKED");

  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Spin" WHERE "id" = ${spin.id} FOR UPDATE`;
      const current = await tx.spin.findUniqueOrThrow({ where: { id: spin.id } });
      const currentItem = current.giftItemId
        ? await tx.giftItem.findUnique({ where: { id: current.giftItemId } })
        : null;
      const poolId = spin.prize.giftPoolId;
      const sizes = await sizeOptionsForPool(tx, poolId, currentItem);
      if (!sizes.options.includes(size)) throw new SpinFailure("SIZE_UNAVAILABLE");

      if (sizes.stockKnown && poolId && normalizeSize(currentItem?.size) !== size) {
        const replacement = await allocateGiftItem(tx, poolId, randomInt, size);
        if (!replacement) throw new SpinFailure("SIZE_UNAVAILABLE");
        if (current.giftItemId) await releaseGiftItem(tx, current.giftItemId);
        await tx.spin.update({ where: { id: spin.id }, data: { giftItemId: replacement.id } });
        await recalcGiftPool(tx, poolId);
      }

      await tx.winner.update({
        where: { spinId: spin.id },
        data: {
          sizePreference: size,
          customerNote: input.note?.trim() ? input.note.trim().slice(0, 300) : null,
          customerConfirmedAt: now,
        },
      });
    }, TRANSACTION_OPTIONS);
  } catch (error) {
    if (error instanceof SpinFailure) return luckyError(error.code);
    throw error;
  }

  return { ok: true, result: await getSpinResultView(spin.id) };
}
