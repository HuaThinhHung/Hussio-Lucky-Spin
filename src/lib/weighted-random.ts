// Weighted random selection with an injectable integer RNG.
// Production code passes `crypto.randomInt` — never Math.random().

/** Returns a uniformly distributed integer in [0, max). */
export type RandomIntFn = (max: number) => number;

export type WeightedEntry<T> = { item: T; weight: number };

export type WeightedPick<T> = {
  item: T;
  /** The raw random draw, stored on the Spin for auditability. */
  randomValue: number;
  totalWeight: number;
};

export function totalWeightOf<T>(entries: WeightedEntry<T>[]): number {
  return entries.reduce((sum, entry) => sum + (isUsableWeight(entry.weight) ? entry.weight : 0), 0);
}

function isUsableWeight(weight: number): boolean {
  return Number.isSafeInteger(weight) && weight > 0;
}

export function pickWeighted<T>(
  entries: WeightedEntry<T>[],
  randomInt: RandomIntFn,
): WeightedPick<T> | null {
  const usable = entries.filter((entry) => isUsableWeight(entry.weight));
  const totalWeight = totalWeightOf(usable);
  if (totalWeight <= 0) return null;

  const randomValue = randomInt(totalWeight);
  if (!Number.isInteger(randomValue) || randomValue < 0 || randomValue >= totalWeight) {
    throw new RangeError(`randomInt returned ${randomValue}, expected [0, ${totalWeight})`);
  }

  let cumulative = 0;
  for (const entry of usable) {
    cumulative += entry.weight;
    if (randomValue < cumulative) {
      return { item: entry.item, randomValue, totalWeight };
    }
  }
  // Unreachable: randomValue < totalWeight guarantees a match above.
  throw new Error("Weighted selection failed");
}
