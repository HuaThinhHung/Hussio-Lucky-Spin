"use client";

import { useState, useRef, type ReactNode } from "react";
import Image from "next/image";
import FluidBackground from "@/components/home/FluidBackground";


export default function ThemeShell({ initialTheme, shopUrl, children }: {
  initialTheme: "light" | "dark";
  shopUrl: string;
  children: ReactNode;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState(initialTheme);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);

  }

  return <div ref={shellRef} onPointerMove={event => {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--tilt-y", `${((event.clientX - rect.left) / rect.width - .5) * 7}deg`);
    event.currentTarget.style.setProperty("--tilt-x", `${(event.clientY / window.innerHeight - .5) * -5}deg`);
    event.currentTarget.style.setProperty("--pointer-x", `${((event.clientX - rect.left) / rect.width - .5) * 30}px`);
    event.currentTarget.style.setProperty("--pointer-y", `${(event.clientY / window.innerHeight - .5) * 24}px`);
  }} onPointerLeave={() => {
    shellRef.current?.style.setProperty("--tilt-x", "0deg");
    shellRef.current?.style.setProperty("--tilt-y", "0deg");
    shellRef.current?.style.setProperty("--pointer-x", "0px");
    shellRef.current?.style.setProperty("--pointer-y", "0px");
  }} data-theme={theme} className="public-theme bg-hussio-gradient min-h-dvh text-ivory">
    <div className="ambient-scene" aria-hidden="true"><div className="ambient-ribbon ribbon-one" /><div className="ambient-ribbon ribbon-two" /><div className="ambient-orb" /></div>
    <FluidBackground theme={theme} />
    <header className="campaign-header">
      <a className="header-logo" href={shopUrl} aria-label="HUSSIO — Trang chủ"><Image src="/brand/hussio-logo.png" alt="HUSSIO" width={1628} height={241} priority /></a>
      <div className="flex items-center gap-3 sm:gap-5">
        <a href={shopUrl} className="text-[10px] tracking-widest text-ivory sm:text-xs">MUA SẮM ↗</a>
        <button type="button" onClick={toggleTheme}
          aria-label={theme === "dark" ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-ivory/25 px-3 text-xs font-semibold text-ivory hover:border-gold">
          <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
          {theme === "dark" ? "Sáng" : "Tối"}
        </button>
      </div>
    </header>
    {children}
  </div>;
}
