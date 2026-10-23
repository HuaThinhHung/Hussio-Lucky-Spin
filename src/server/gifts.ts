import "server-only";
import type { GiftItem } from "@/generated/prisma/client";
import { SIZE_OPTIONS } from "@/lib/constants";
import { pickWeighted, type RandomIntFn } from "@/lib/weighted-random";
import type { DbOrTx, Tx } from "@/server/db";

export function normalizeSize(size: string | null | undefined): string | null {
  const value = size?.trim().toUpperCase();
  return value ? value : null;
}

/** Pool ids (among `poolIds`) that still have at least one active item in stock. */
export async function poolsWithStock(client: DbOrTx, poolIds: string[]): Promise<Set<string>> {
  if (poolIds.length === 0) return new Set();
  const rows = await client.giftItem.groupBy({
    by: ["giftPoolId"],
    where: { giftPoolId: { in: poolIds }, active: true, quantity: { gt: 0 } },
    _sum: { quantity: true },
  });
  return new Set(rows.filter((row) => (row._sum.quantity ?? 0) > 0).map((row) => row.giftPoolId));
}

/**
 * Reserves one unit of a gift item in `poolId` (weighted by remaining quantity,
 * secure RNG). The conditional UPDATE makes it safe under concurrency: an item
 * that just ran out is skipped and another one is tried.
 */
export async function allocateGiftItem(
  tx: Tx,
  poolId: string,
  randomInt: RandomIntFn,
  requiredSize?: string | null,
): Promise<GiftItem | null> {
  const size = normalizeSize(requiredSize);
  let candidates = (
    await tx.giftItem.findMany({
      where: { giftPoolId: poolId, active: true, quantity: { gt: 0 } },
      orderBy: { id: "asc" },
    })
  ).filter((item) => !size || normalizeSize(item.size) === size);

  while (candidates.length > 0) {
    const pick = pickWeighted(
      candidates.map((item) => ({ item, weight: item.quantity })),
      randomInt,
    );
    if (!pick) return null;
    const reserved = await tx.$executeRaw`
      UPDATE "GiftItem" SET "quantity" = "quantity" - 1, "updatedAt" = now()
      WHERE "id" = ${pick.item.id} AND "quantity" > 0 AND "active" = true`;
    if (reserved === 1) return pick.item;
    candidates = candidates.filter((item) => item.id !== pick.item.id);
  }
  return null;
}

/** Puts one unit back into stock (reward voided or size swapped). */
export async function releaseGiftItem(tx: Tx, giftItemId: string): Promise<void> {
  await tx.$executeRaw`
    UPDATE "GiftItem" SET "quantity" = "quantity" + 1, "updatedAt" = now() WHERE "id" = ${giftItemId}`;
}

/** Recomputes the denormalised counters of a gift pool. */
export async function recalcGiftPool(client: DbOrTx, poolId: string): Promise<void> {
  const stock = await client.giftItem.aggregate({
    where: { giftPoolId: poolId, active: true },
    _sum: { quantity: true },
  });
  const allocated = await client.spin.count({
    where: { status: "COMPLETED", giftItem: { giftPoolId: poolId } },
  });
  const remaining = stock._sum.quantity ?? 0;
  await client.giftPool.update({
    where: { id: poolId },
    data: { quantityRemaining: remaining, quantityTotal: remaining + allocated },
  });
}

export type SizeOptions = { options: string[]; stockKnown: boolean };

function sortSizes(sizes: Iterable<string>): string[] {
  const order: readonly string[] = SIZE_OPTIONS;
  return Array.from(new Set(sizes)).sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

/**
 * Sizes a winner may choose. If the pool has items with sizes, only sizes in
 * stock (plus the size already allocated) are offered. Otherwise all standard
 * sizes are offered and the choice is stored as a preference for CS.
 */
export async function sizeOptionsForPool(
  client: DbOrTx,
  poolId: string | null,
  allocated: Pick<GiftItem, "size"> | null,
): Promise<SizeOptions> {
  if (!poolId) return { options: [...SIZE_OPTIONS], stockKnown: false };
  const sizedItems = await client.giftItem.findMany({
    where: { giftPoolId: poolId, active: true, size: { not: null } },
    select: { size: true, quantity: true },
  });
  const known = sizedItems.filter((item) => normalizeSize(item.size));
  if (known.length === 0) return { options: [...SIZE_OPTIONS], stockKnown: false };

  const inStock = known
    .filter((item) => item.quantity > 0)
    .map((item) => normalizeSize(item.size))
    .filter((size): size is string => Boolean(size));
  const allocatedSize = normalizeSize(allocated?.size);
  if (allocatedSize) inStock.push(allocatedSize);
  return { options: sortSizes(inStock), stockKnown: true };
}
