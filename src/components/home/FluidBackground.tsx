"use client";

import { useEffect, useRef } from "react";

/** A real fluid simulation: mouse movement injects dye and velocity into the field. */
export default function FluidBackground({ theme }: { theme: "light" | "dark" }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let cancelled = false;
    let dispose: (() => void) | undefined;
    async function initialize() {
      if (motion.matches) return;
      try {
        const { default: Fluid } = await import("webgl-fluid-enhanced");
        if (cancelled) return;
        const fluid = new Fluid(container!);
        container!.style.position = "fixed";
        fluid.setConfig({
          simResolution: 128, dyeResolution: window.innerWidth < 640 ? 720 : 1440,
          densityDissipation: .5, velocityDissipation: 3,
          pressure: .1, pressureIterations: 20, curl: 3, splatRadius: .2,
          splatForce: 6000, shading: true, colorful: true,
          colorUpdateSpeed: 10, backgroundColor: "#000000",
          inverted: false, transparent: true,
          brightness: .1, bloom: false, sunrays: false, hover: false,
        });
        fluid.start();
        let previous: { x: number; y: number } | null = null;
        let last = 0;
        const move = (event: PointerEvent) => {
          if (motion.matches || event.pointerType !== "mouse") return;
          const now = performance.now();
          if (now - last < 16) return;
          last = now;
          const x = event.clientX, y = event.clientY;
          const canvas = container!.querySelector("canvas");
          const ratio = canvas ? canvas.width / canvas.clientWidth : 1;
          if (previous) {
            const aspect = window.innerWidth / window.innerHeight;
            const dx = (x - previous.x) / window.innerWidth * Math.min(aspect, 1);
            const dy = (previous.y - y) / window.innerHeight / Math.max(aspect, 1);
            fluid.splatAtLocation(x * ratio, y, dx * 6000, dy * 6000);
          }
          previous = { x, y };
        };
        const reset = () => { previous = null; };
        const visibility = () => {
          if (document.hidden || motion.matches) fluid.stop();
          else fluid.start();
        };
        window.addEventListener("pointermove", move, { passive: true });
        document.addEventListener("pointerleave", reset);
        document.addEventListener("visibilitychange", visibility);
        motion.addEventListener("change", visibility);
        dispose = () => {
          window.removeEventListener("pointermove", move);
          document.removeEventListener("pointerleave", reset);
          document.removeEventListener("visibilitychange", visibility);
          motion.removeEventListener("change", visibility);
          fluid.stop();
          const canvas = container!.querySelector("canvas");
          const gl = canvas?.getContext("webgl2") || canvas?.getContext("webgl");
          gl?.getExtension("WEBGL_lose_context")?.loseContext();
          container!.replaceChildren();
        };
      } catch {
        // The plain brand background remains usable without WebGL.
        container!.replaceChildren();
      }
    }
    void initialize();
    return () => { cancelled = true; dispose?.(); };
  }, [theme]);
  return <div ref={containerRef} className="fluid-background" aria-hidden="true" />;
}
