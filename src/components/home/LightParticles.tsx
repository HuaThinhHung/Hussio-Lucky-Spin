import type { CSSProperties } from "react";

// Subtle floating gold specks (decorative, hidden from assistive tech,
// disabled by prefers-reduced-motion in globals.css). Deterministic layout.
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  top: 30 + ((i * 53) % 65),
  size: 2 + (i % 3),
  delay: (i * 0.7) % 9,
  duration: 8 + (i % 5) * 1.5,
  drift: ((i % 2 === 0 ? 1 : -1) * (6 + (i % 4) * 5)),
  opacity: 0.35 + (i % 4) * 0.12,
}));

export default function LightParticles() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {PARTICLES.map((particle, index) => (
        <span
          key={index}
          className="light-particle"
          style={
            {
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              "--particle-size": `${particle.size}px`,
              "--particle-delay": `${particle.delay}s`,
              "--particle-duration": `${particle.duration}s`,
              "--particle-drift": `${particle.drift}px`,
              "--particle-opacity": particle.opacity,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
