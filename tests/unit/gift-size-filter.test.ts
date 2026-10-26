import { describe, expect, it } from "vitest";
import { toSegments } from "@/lib/gift-wheel";
import type { CatalogGift } from "@/lib/lucky-types";

const gifts: CatalogGift[] = [
  { id: "shirt", name: "ÁO SƠ MI BROWY", group: "top", sizes: ["M", "XL"], available: true },
  { id: "unknown", name: "ÁO POLO HARU", group: "top", sizes: [], available: true },
  { id: "pants", name: "QUẦN DÀI", group: "pants", sizes: ["30"], available: true },
  { id: "socks", name: "Tặng vớ", group: "any", sizes: [], available: true },
];
describe("size selection on the wheel", () => {
  it("dims unknown and unselected sizes even in preview without changing slice order", () => {
    const segments = toSegments(gifts, { top: ["L"], pants: [] }, false);
    expect(segments.map(s => s.id)).toEqual(gifts.map(g => g.id));
    expect(segments.map(s => s.disabled)).toEqual([true, true, true, false]);
  });
  it("matches any selected size and only displays selected matching sizes", () => {
    const segments = toSegments(gifts, { top: ["L", "XL"], pants: ["30"] });
    expect(segments.map(s => s.disabled)).toEqual([false, true, false, false]);
    expect(segments[0].sizeLabel).toBe("Size XL");
    expect(segments[2].sizeLabel).toBe("Size 30");
  });
  it("restores the overview when the last size is unchecked", () => {
    expect(toSegments(gifts, { top: [], pants: [] }).every(s => !s.disabled)).toBe(true);
  });
});
