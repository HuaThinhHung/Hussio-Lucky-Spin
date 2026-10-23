import { randomInt } from "node:crypto";
import { describe, expect, it } from "vitest";
import { pickWeighted } from "@/lib/weighted-random";
import { segmentAtRotation, segmentThemes, targetRotation } from "@/lib/wheel";

describe("weighted random", () => {
  const entries = [
    { item: "a", weight: 30 },
    { item: "b", weight: 0 },
    { item: "c", weight: 70 },
  ];

  it("maps the random draw onto cumulative weights", () => {
    expect(pickWeighted(entries, () => 0)?.item).toBe("a");
    expect(pickWeighted(entries, () => 29)?.item).toBe("a");
    expect(pickWeighted(entries, () => 30)?.item).toBe("c");
    expect(pickWeighted(entries, () => 99)?.item).toBe("c");
    expect(pickWeighted(entries, () => 99)?.totalWeight).toBe(100);
  });

  it("never picks zero-weight entries and returns null when nothing is eligible", () => {
    for (let i = 0; i < 100; i += 1) expect(pickWeighted(entries, (max) => i % max)?.item).not.toBe("b");
    expect(pickWeighted([{ item: "x", weight: 0 }], randomInt)).toBeNull();
  });

  it("rejects an out-of-range RNG", () => {
    expect(() => pickWeighted(entries, () => 100)).toThrow(RangeError);
  });

  it("roughly follows the configured probabilities with crypto.randomInt", () => {
    const counts = { a: 0, b: 0, c: 0 } as Record<string, number>;
    const runs = 20_000;
    for (let i = 0; i < runs; i += 1) counts[pickWeighted(entries, randomInt)!.item] += 1;
    expect(counts.a / runs).toBeGreaterThan(0.27);
    expect(counts.a / runs).toBeLessThan(0.33);
    expect(counts.b).toBe(0);
  });
});

describe("wheel geometry", () => {
  it("lands every segment under the pointer from any starting rotation", () => {
    for (const count of [2, 5, 9, 12]) {
      for (let index = 0; index < count; index += 1) {
        for (const start of [0, 37, 360 * 3 + 123.4, -90]) {
          const rotation = targetRotation(start, index, count, 6, 0);
          expect(rotation).toBeGreaterThan(start + 6 * 360 - 1);
          expect(segmentAtRotation(rotation, count)).toBe(index);
        }
      }
    }
  });

  it("keeps the landing inside the segment with cosmetic jitter", () => {
    const count = 9;
    const maxJitter = (360 / count / 2) * 0.55;
    for (let index = 0; index < count; index += 1) {
      expect(segmentAtRotation(targetRotation(0, index, count, 5, maxJitter), count)).toBe(index);
      expect(segmentAtRotation(targetRotation(0, index, count, 5, -maxJitter), count)).toBe(index);
    }
  });

  it("never paints two neighbouring segments the same colour", () => {
    for (let count = 3; count <= 12; count += 1) {
      const themes = segmentThemes(count);
      for (let i = 0; i < count; i += 1) {
        expect(themes[i].fill).not.toBe(themes[(i + 1) % count].fill);
      }
    }
  });
});
