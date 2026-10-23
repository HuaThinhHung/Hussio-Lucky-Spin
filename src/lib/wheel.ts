// Wheel geometry and colours — shared by the server (segment index) and the
// client (animation). The client never chooses a prize: it only rotates to the
// segment index returned by the server.

export const WHEEL_PALETTE = {
  navy: "#252525",
  darkNavy: "#111111",
  ivory: "#F5F5F0",
  gold: "#D92D32",
  lightGold: "#FFFFFF",
} as const;

export type SegmentTheme = {
  fill: string;
  label: string;
  caption: string;
};

const THEMES: Record<"navy" | "darkNavy" | "ivory" | "gold", SegmentTheme> = {
  navy: { fill: WHEEL_PALETTE.navy, label: WHEEL_PALETTE.ivory, caption: WHEEL_PALETTE.lightGold },
  darkNavy: { fill: WHEEL_PALETTE.darkNavy, label: WHEEL_PALETTE.lightGold, caption: WHEEL_PALETTE.ivory },
  ivory: { fill: WHEEL_PALETTE.ivory, label: WHEEL_PALETTE.navy, caption: "#626262" },
  gold: { fill: WHEEL_PALETTE.gold, label: WHEEL_PALETTE.ivory, caption: WHEEL_PALETTE.ivory },
};

const CYCLE = ["navy", "ivory", "darkNavy", "gold"] as const;

/** Alternating navy / ivory / dark navy / gold, never two equal neighbours (incl. wrap-around). */
export function segmentThemes(count: number): SegmentTheme[] {
  const keys: (typeof CYCLE)[number][] = Array.from({ length: count }, (_, i) => CYCLE[i % CYCLE.length]);
  if (count > 2 && keys[count - 1] === keys[0]) {
    const previous = keys[count - 2];
    keys[count - 1] = CYCLE.find((key) => key !== keys[0] && key !== previous) ?? "ivory";
  }
  return keys.map((key) => THEMES[key]);
}

export function segmentAngle(count: number): number {
  return 360 / count;
}

/** Centre of segment i, in degrees clockwise from 12 o'clock. */
export function segmentCenterAngle(index: number, count: number): number {
  return (index + 0.5) * segmentAngle(count);
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

/** Deterministic cosmetic offset inside the segment so it doesn't always stop dead-centre. */
export function cosmeticJitter(seed: string, count: number): number {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const maxOffset = (segmentAngle(count) / 2) * 0.55;
  return ((hash % 1000) / 1000) * 2 * maxOffset - maxOffset;
}

/**
 * Absolute rotation (deg) that lands `index` under the top pointer, always
 * moving forward from `currentRotation` with `turns` extra full rotations.
 */
export function targetRotation(
  currentRotation: number,
  index: number,
  count: number,
  turns = 6,
  jitter = 0,
): number {
  const desired = mod(360 - segmentCenterAngle(index, count) - jitter, 360);
  const delta = mod(desired - mod(currentRotation, 360), 360);
  return currentRotation + turns * 360 + delta;
}

/** Which segment is under the pointer for a given rotation (used by tests). */
export function segmentAtRotation(rotation: number, count: number): number {
  const angleUnderPointer = mod(-rotation, 360);
  return Math.floor(angleUnderPointer / segmentAngle(count)) % count;
}
