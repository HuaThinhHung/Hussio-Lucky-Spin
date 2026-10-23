"use client";

import type { CSSProperties } from "react";

// Small gold/ivory confetti burst — no rainbow palette. Pieces are laid out
// deterministically (no randomness needed for decoration).
const COLORS = ["#D92D32", "#F5F5F0", "#A3A3A3", "#FFFFFF"];
const PIECES = Array.from({ length: 42 }, (_, i) => ({
  left: (i * 23 + 7) % 100,
  delay: ((i * 37) % 60) / 100,
  duration: 2.2 + ((i * 13) % 10) / 10,
  drift: ((i % 2 === 0 ? 1 : -1) * ((i * 17) % 90)),
  spin: 360 + ((i * 47) % 360),
  width: 4 + (i % 3) * 2,
  height: 8 + (i % 4) * 3,
  color: COLORS[i % COLORS.length],
}));

export default function Confetti() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {PIECES.map((piece, index) => (
        <span
          key={index}
          className="confetti-piece"
          style={
            {
              left: `${piece.left}%`,
              "--confetti-delay": `${piece.delay}s`,
              "--confetti-duration": `${piece.duration}s`,
              "--confetti-drift": `${piece.drift}px`,
              "--confetti-spin": `${piece.spin}deg`,
              "--confetti-w": `${piece.width}px`,
              "--confetti-h": `${piece.height}px`,
              "--confetti-color": piece.color,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
