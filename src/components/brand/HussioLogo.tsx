import { cn } from "@/lib/cn";

type HussioLogoProps = {
  className?: string;
  tone?: "light" | "dark";
};

/**
 * Text wordmark. To use the official logo file, replace the span with
 * <Image src="/brand/hussio-logo.svg" … /> — no other changes needed.
 */
export default function HussioLogo({ className, tone = "light" }: HussioLogoProps) {
  return (
    <span
      className={cn(
        "font-display text-xl font-semibold tracking-[0.32em] sm:text-2xl",
        tone === "light" ? "text-ivory" : "text-navy",
        className,
      )}
    >
      HUSSIO
    </span>
  );
}
