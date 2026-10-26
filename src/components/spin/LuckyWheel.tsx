"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/cn";
import type { WheelSegmentView } from "@/lib/lucky-types";
import { segmentAngle, segmentCenterAngle, segmentThemes, WHEEL_PALETTE } from "@/lib/wheel";

const SIZE = 400;
const CENTER = SIZE / 2;
const RADIUS = 178;
const RIM_DOTS = 18;
const SPIN_EASING = "cubic-bezier(0.12, 0.72, 0.08, 1)";

type LuckyWheelProps = {
  segments: WheelSegmentView[];
  /** Absolute rotation in degrees (only ever increases). */
  rotation: number;
  durationMs: number;
  isSpinning: boolean;
  winningIndex: number | null;
  canSpin: boolean;
  onSpinClick: () => void;
  onSpinEnd: () => void;
};

/** Rounded so server and browser render identical SVG (no hydration mismatch). */
function polar(angleDeg: number, radius: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  const round = (value: number) => Math.round(value * 100) / 100;
  return [round(CENTER + radius * Math.sin(rad)), round(CENTER - radius * Math.cos(rad))];
}

function segmentPath(index: number, count: number, radius = RADIUS): string {
  const start = index * segmentAngle(count);
  const end = start + segmentAngle(count);
  const [x1, y1] = polar(start, radius);
  const [x2, y2] = polar(end, radius);
  const largeArc = end - start > 180 ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

function labelFontSize(label: string): number {
  const length = Array.from(label).length;
  if (length <= 4) return 22;
  if (length <= 6) return 18;
  return 15;
}

export default function LuckyWheel({
  segments,
  rotation,
  durationMs,
  isSpinning,
  winningIndex,
  canSpin,
  onSpinClick,
  onSpinEnd,
}: LuckyWheelProps) {
  const count = Math.max(segments.length, 1);
  const themes = useMemo(() => segmentThemes(count), [count]);
  const onSpinEndRef = useRef(onSpinEnd);

  useEffect(() => {
    onSpinEndRef.current = onSpinEnd;
  }, [onSpinEnd]);

  // Fallback in case `transitionend` doesn't fire (tab hidden, etc.).
  useEffect(() => {
    if (!isSpinning) return;
    const timer = window.setTimeout(() => onSpinEndRef.current(), durationMs + 500);
    return () => window.clearTimeout(timer);
  }, [isSpinning, rotation, durationMs]);

  const ariaLabel = `Vòng quay HUSSIO gồm ${segments.length} phần quà: ${segments.map((s) => s.name).join(", ")}.`;

  return (
    <div className={cn("wheel-artwork relative mx-auto aspect-square w-full max-w-[min(90vw,600px)]", isSpinning && "is-spinning")}>
      {/* Pointer (static, outside the rotating layer) */}
      <div aria-hidden="true" className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-[38%]">
        <svg width="44" height="54" viewBox="0 0 44 54">
          <defs>
            <linearGradient id="pointer-gold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F5F5F0" />
              <stop offset="100%" stopColor="#D92D32" />
            </linearGradient>
          </defs>
          <path d="M6 3 Q3 3 4 8 L22 49 L40 8 Q41 3 38 3 Z" fill="url(#pointer-gold)" stroke="#111111" strokeWidth="2" />
          <circle cx="22" cy="14" r="6" fill="#111111" />
        </svg>
      </div>

      <div className="wheel-outline absolute inset-0 rounded-full" aria-hidden="true" />

      {/* Rotating layer */}
      <div
        className="absolute inset-0"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: isSpinning ? `transform ${durationMs}ms ${SPIN_EASING}` : "none",
          willChange: "transform",
        }}
        onTransitionEnd={(event) => {
          if (event.propertyName === "transform" && isSpinning) onSpinEndRef.current();
        }}
      >
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={ariaLabel} className="size-full">
          <defs>
            <linearGradient id="rim-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F5F5F0" />
              <stop offset="45%" stopColor="#555555" />
              <stop offset="100%" stopColor="#333333" />
            </linearGradient>
            <radialGradient id="segment-sheen" cx="50%" cy="50%" r="50%">
              <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.08" />
            </radialGradient>
          </defs>

          <circle cx={CENTER} cy={CENTER} r={198} fill={WHEEL_PALETTE.darkNavy} />
          <circle cx={CENTER} cy={CENTER} r={194} fill="none" stroke="url(#rim-gold)" strokeWidth={3} />

          {segments.map((segment, index) => {
            const theme = themes[index];
            const center = segmentCenterAngle(index, count);
            return (
              <g key={segment.id}>
                <title>{`${segment.name} — ${segment.sizeLabel ?? segment.caption ?? ""}${segment.disabled ? " — không khả dụng với lựa chọn hiện tại" : ""}`}</title>
                <path d={segmentPath(index, count)} fill={segment.disabled ? "#17191e" : theme.fill} stroke="#555555" strokeOpacity={0.55} strokeWidth={0.45} />
                <g transform={`rotate(${center} ${CENTER} ${CENTER})`}>
                  <text
                    transform={`translate(${CENTER} ${CENTER}) rotate(-90)`}
                    x={RADIUS - 14}
                    y={count > 12 ? -2.5 : -4}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fill={segment.disabled ? "#626671" : theme.label}
                    fontSize={count > 12 ? 4.7 : labelFontSize(segment.label)}
                    textLength={count > 12 && segment.name.length > 32 ? 102 : undefined}
                    lengthAdjust="spacingAndGlyphs"
                    fontWeight={700}
                    letterSpacing={count > 12 ? 0 : .5}
                    style={{ fontFamily: "var(--font-be-vietnam), sans-serif" }}
                  >
                    {count > 12 ? segment.name.toUpperCase() : segment.label}
                  </text>
                  {(segment.sizeLabel || segment.caption) ? (
                    <text
                      transform={`translate(${CENTER} ${CENTER}) rotate(-90)`}
                      x={RADIUS - 16}
                      y={count > 12 ? 3.5 : 15}
                      textAnchor="end"
                      dominantBaseline="middle"
                      fill={segment.disabled ? "#626671" : theme.caption}
                      fontSize={count > 12 ? 3.5 : 9.5}
                      fontWeight={600}
                      letterSpacing={count > 12 ? 0 : 1}
                      style={{ fontFamily: "var(--font-be-vietnam), sans-serif" }}
                    >
                      {count > 12 ? segment.sizeLabel ?? segment.caption : [segment.caption, segment.sizeLabel].filter(Boolean).join(" · ")}
                    </text>
                  ) : null}
                </g>
              </g>
            );
          })}

          {winningIndex !== null && !isSpinning ? (
            <path className="wheel-winner-glow" d={segmentPath(winningIndex, count)} fill="#F5F5F0" />
          ) : null}

          <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="url(#segment-sheen)" pointerEvents="none" />

          <g>
            {Array.from({ length: RIM_DOTS }, (_, i) => {
              const [x, y] = polar((360 / RIM_DOTS) * i, 194);
              return (
                <circle
                  key={i}
                  className="wheel-rim-dot"
                  cx={x}
                  cy={y}
                  r={2.6}
                  fill={i % 2 === 0 ? WHEEL_PALETTE.ivory : WHEEL_PALETTE.darkNavy}
                />
              );
            })}
          </g>

          {/* Hub */}
          <circle cx={CENTER} cy={CENTER} r={58} fill={WHEEL_PALETTE.darkNavy} stroke="url(#rim-gold)" strokeWidth={4} />
        </svg>
      </div>

      {/* Static centre button (doesn't rotate) */}
      <button
        type="button"
        onClick={onSpinClick}
        disabled={!canSpin}
        aria-label={canSpin ? "Quay vòng quay" : "Nhập mã hợp lệ để quay"}
        className={cn(
          "absolute left-1/2 top-1/2 z-10 flex size-[24%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-gold/60 bg-navy-dark text-center transition",
          canSpin ? "cursor-pointer hover:scale-105 hover:shadow-[0_0_30px_rgba(217,45,50,0.2)]" : "cursor-not-allowed",
        )}
      >
        <span className="font-display text-[clamp(9px,2.6vw,13px)] font-semibold tracking-[0.25em] text-gold-light">HUSSIO</span>
        <span
          className={cn(
            "mt-0.5 text-[clamp(11px,3.4vw,17px)] font-bold tracking-[0.18em]",
            canSpin ? "text-ivory" : "text-ivory/40",
          )}
        >
          QUAY
        </span>
      </button>
    </div>
  );
}
