"use client";

import { useEffect, useRef } from "react";

type Point = { x: number; y: number };

// Phones have no hover: a slow virtual brush keeps the fluid moving between touches.
// Short strokes with long rests keep the light pastel look of an occasional mouse move.
const BRUSH_STROKE_MS = 1600;
const BRUSH_PAUSE_MS = 2400;
const BRUSH_STEP_MS = 48;
const BRUSH_IDLE_AFTER_TOUCH_MS = 1800;

/**
 * A real fluid simulation. A mouse injects dye and velocity as it moves; on touch
 * screens a finger drag or scroll stirs the field and an automatic brush draws
 * ribbons, so mobile shows the same effect as desktop.
 */
export default function FluidBackground({ theme }: { theme: "light" | "dark" }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const touchScreen = !window.matchMedia("(hover: hover) and (pointer: fine)").matches;
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
          simResolution: 128, dyeResolution: window.innerWidth < 640 ? 1024 : 1440,
          densityDissipation: .5, velocityDissipation: 3,
          pressure: .1, pressureIterations: 20, curl: 3, splatRadius: touchScreen ? .25 : .2,
          splatForce: 6000, shading: true, colorful: true,
          colorUpdateSpeed: 10, backgroundColor: "#000000",
          inverted: false, transparent: true,
          brightness: .1, bloom: false, sunrays: false, hover: false,
        });
        fluid.start();

        // splatAtLocation takes x in canvas pixels but y in CSS pixels.
        const stir = (from: Point, to: Point, force: number) => {
          const aspect = window.innerWidth / window.innerHeight;
          const dx = (to.x - from.x) / window.innerWidth * Math.min(aspect, 1);
          const dy = (from.y - to.y) / window.innerHeight / Math.max(aspect, 1);
          const canvas = container!.querySelector("canvas");
          const ratio = canvas ? canvas.width / canvas.clientWidth : 1;
          fluid.splatAtLocation(to.x * ratio, to.y, dx * force, dy * force);
        };

        let previous: Point | null = null;
        let last = 0;
        const move = (event: PointerEvent) => {
          if (motion.matches || event.pointerType !== "mouse") return;
          const now = performance.now();
          if (now - last < 16) return;
          last = now;
          const point = { x: event.clientX, y: event.clientY };
          if (previous) stir(previous, point, 6000);
          previous = point;
        };
        const reset = () => { previous = null; };

        let finger: Point | null = null;
        let lastFinger = 0;
        let touchedAt = -Infinity;
        const touch = (event: TouchEvent) => {
          const contact = event.touches[0];
          if (motion.matches || !contact) return;
          const now = performance.now(), point = { x: contact.clientX, y: contact.clientY };
          touchedAt = now;
          if (event.type === "touchstart" || !finger) { finger = point; return; }
          if (now - lastFinger < 16) return;
          lastFinger = now;
          stir(finger, point, 9000);
          finger = point;
        };

        let frame = 0;
        let brush: Point | null = null;
        let strokeAt = performance.now(), phase = Math.random() * Math.PI * 2, lastBrush = 0;
        const paint = (now: number) => {
          frame = requestAnimationFrame(paint);
          if (motion.matches || now - touchedAt < BRUSH_IDLE_AFTER_TOUCH_MS) { brush = null; return; }
          const elapsed = now - strokeAt;
          if (elapsed > BRUSH_STROKE_MS + BRUSH_PAUSE_MS) {
            strokeAt = now;
            phase = Math.random() * Math.PI * 2;
            brush = null;
            return;
          }
          if (elapsed > BRUSH_STROKE_MS) { brush = null; return; }
          if (now - lastBrush < BRUSH_STEP_MS) return;
          lastBrush = now;
          const t = now / 1000;
          const point = {
            x: window.innerWidth * (.5 + .4 * Math.sin(t * .9 + phase)),
            y: window.innerHeight * (.45 + .35 * Math.sin(t * 1.3 + phase * 1.7)),
          };
          if (brush) stir(brush, point, 7000);
          brush = point;
        };
        if (touchScreen) frame = requestAnimationFrame(paint);

        const visibility = () => {
          if (document.hidden || motion.matches) fluid.stop();
          else fluid.start();
        };
        window.addEventListener("pointermove", move, { passive: true });
        window.addEventListener("touchstart", touch, { passive: true });
        window.addEventListener("touchmove", touch, { passive: true });
        document.addEventListener("pointerleave", reset);
        document.addEventListener("visibilitychange", visibility);
        motion.addEventListener("change", visibility);
        dispose = () => {
          cancelAnimationFrame(frame);
          window.removeEventListener("pointermove", move);
          window.removeEventListener("touchstart", touch);
          window.removeEventListener("touchmove", touch);
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
