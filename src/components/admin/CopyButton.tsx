"use client";

import { useState } from "react";
import { copyToClipboard } from "@/components/spin/api";
import { cn } from "@/lib/cn";

type CopyButtonProps = {
  text: string;
  label: string;
  copiedLabel?: string;
  className?: string;
};

export default function CopyButton({ text, label, copiedLabel = "Đã sao chép ✓", className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    if (await copyToClipboard(text)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex h-8 items-center rounded-lg border border-navy/20 bg-white px-3 text-xs font-semibold text-navy transition hover:border-gold-deep hover:text-gold-deep",
        className,
      )}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
