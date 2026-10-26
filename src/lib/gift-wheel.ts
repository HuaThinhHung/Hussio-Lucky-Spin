// Turns the Sheet gift catalog into wheel segments and size buttons.
import bundled from "@/lib/gift-catalog.json";
import type { PrizeType } from "@/generated/prisma/enums";
import type { CatalogGift, WheelSegmentView } from "@/lib/lucky-types";
import { SHEET_SEGMENTS } from "@/lib/sheet-campaign";

/** Sizes the customer accepts per group; any of them may be drawn. */
export type SizeChoice = { top: string[]; pants: string[] };

/** More sizes = more gifts in the draw; the server caps it at the same number. */
export const MAX_SIZES = 3;

/** Snapshot of the Sheet (46 garments + accessories/vouchers) shown until the live catalog loads, and in local preview. */
export const FALLBACK_GIFTS: CatalogGift[] = [
  ...bundled.map((gift) => ({
    id: gift.id,
    name: gift.name,
    group: gift.category === "pants" ? ("pants" as const) : ("top" as const),
    sizes: gift.sizes,
    available: true,
  })),
  ...SHEET_SEGMENTS.map((gift) => ({ id: gift.id, name: gift.name, group: "any" as const, sizes: [], available: true })),
  { id: "box", name: "Hộp Cotton", group: "any", sizes: [], available: true },
];

export const DEFAULT_TOP_SIZES = ["M", "L", "XL", "XXL"];
const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL", "XXXL"];

/** Letter sizes in wearing order, numeric sizes (quần 29, 30…) ascending. */
export function sortSizes(sizes: string[]): string[] {
  const rank = (size: string) => {
    const index = SIZE_ORDER.indexOf(size);
    if (index >= 0) return index;
    const number = Number(size);
    return Number.isFinite(number) ? 100 + number : 1000;
  };
  return [...new Set(sizes)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

const CAPTIONS: [RegExp, string][] = [
  [/^ÁO KHOÁC /i, "ÁO KHOÁC"],
  [/^ÁO THUN /i, "ÁO THUN"],
  [/^ÁO POLO /i, "ÁO POLO"],
  [/^ÁO SƠ MI /i, "ÁO SƠ MI"],
  [/^QUẦN DÀI /i, "QUẦN DÀI"],
  [/^QUẦN /i, "QUẦN"],
  [/^TẶNG /i, "QUÀ TẶNG"],
];

/** Short wheel label ("LUCUS V2") and caption ("POLO") from a full Sheet name. */
export function wheelLabel(name: string): { label: string; caption: string } {
  for (const [prefix, caption] of CAPTIONS) {
    if (prefix.test(name)) return { label: name.replace(prefix, "").toUpperCase(), caption };
  }
  const voucher = name.match(/^giảm\s+([\d.]+)/i);
  if (voucher) return { label: `-${voucher[1].replace(/\.000$/, "")}K`, caption: "VOUCHER" };
  return { label: name.toUpperCase(), caption: "QUÀ TẶNG" };
}

/**
 * A garment fits when it has stock in one of the chosen sizes of its group.
 * `sizesKnown` is false for the offline snapshot, where most garments carry no
 * size data yet: those stay lit instead of looking sold out.
 */
export function fitsSizes(gift: CatalogGift, sizes: SizeChoice, sizesKnown = true): boolean {
  if (gift.group === "any") return true;
  const chosen = gift.group === "pants" ? sizes.pants : sizes.top;
  if (!chosen.length) return false;
  if (!sizesKnown && !gift.sizes.length) return true;
  return chosen.some((size) => gift.sizes.includes(size));
}

export function hasSizes(sizes: SizeChoice): boolean {
  return sizes.top.length > 0 || sizes.pants.length > 0;
}

/** Before any size is picked every gift in stock is lit; afterwards only the ones that fit. */
export function toSegments(gifts: CatalogGift[], sizes: SizeChoice, sizesKnown = true): WheelSegmentView[] {
  const picked = hasSizes(sizes);
  return gifts.map((gift) => {
    const { label, caption } = wheelLabel(gift.name);
    const type: PrizeType = /^giảm/i.test(gift.name) ? "VOUCHER" : "PRODUCT_POOL";
    const chosen = gift.group === "pants" ? sizes.pants : sizes.top;
    const applicable = sortSizes(gift.sizes.filter((size) => !chosen.length || chosen.includes(size)));
    const sizeLabel = gift.group === "any" ? "Không cần size"
      : !gift.sizes.length ? (sizesKnown ? "Hết size" : "Chưa có size")
      : !applicable.length ? "Không khớp size"
      : `Size ${applicable.join(" / ")}${sizesKnown ? "" : " · tham khảo"}`;
    return { id: gift.id, name: gift.name, label, caption, sizeLabel, type, disabled: !gift.available || (picked && !fitsSizes(gift, sizes, sizesKnown)) };
  });
}

/** How many in-stock gifts each size unlocks (drives the size buttons). */
export function sizeCounts(gifts: CatalogGift[], group: "top" | "pants"): Map<string, number> {
  const counts = new Map<string, number>();
  for (const gift of gifts) {
    if (gift.group !== group || !gift.available) continue;
    for (const size of gift.sizes) counts.set(size, (counts.get(size) ?? 0) + 1);
  }
  return counts;
}
