import type { WheelSegmentView } from "./lucky-types";
export const SHEET_SEGMENTS: WheelSegmentView[] = [
  { id: "socks", name: "Tặng vớ", label: "VỚ", caption: "QUÀ TẶNG", type: "PRODUCT_POOL" },
  { id: "hat", name: "Tặng mũ", label: "MŨ", caption: "QUÀ TẶNG", type: "PRODUCT_POOL" },
  { id: "belt", name: "Tặng thắt lưng", label: "THẮT LƯNG", caption: "QUÀ TẶNG", type: "PRODUCT_POOL" },
  ...[10,20,30,40,50].map(value => ({ id: `v${value}`, name: `Giảm ${value}.000đ`, label: `-${value}K`, caption: "VOUCHER", type: "VOUCHER" as const })),
];
