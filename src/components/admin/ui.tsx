// Small presentational building blocks for the admin (server-safe).
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold text-navy sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-navy/65">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <section className={cn("rounded-2xl border border-navy/10 bg-white p-5 shadow-sm", className)}>
      {title ? <h2 className="mb-4 text-sm font-semibold tracking-wide text-navy">{title}</h2> : null}
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-navy/60">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-navy">{value}</p>
      {hint ? <p className="mt-1 text-xs text-navy/50">{hint}</p> : null}
    </div>
  );
}

const BADGE_TONES = {
  neutral: "bg-navy/5 text-navy/80 ring-navy/15",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  gold: "bg-gold/15 text-gold-deep ring-gold/40",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", BADGE_TONES[tone])}>
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-navy/20 p-8 text-center text-sm text-navy/60">{children}</p>;
}

export const inputClass =
  "h-10 w-full rounded-lg border border-navy/20 bg-white px-3 text-sm text-navy placeholder:text-navy/35 focus:border-navy focus:outline-none focus:ring-2 focus:ring-gold/30";

export const labelClass = "mb-1 block text-xs font-semibold text-navy/75";

export const tableClass = "min-w-full divide-y divide-navy/10 text-sm";
export const thClass = "whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-navy/55";
export const tdClass = "whitespace-nowrap px-3 py-2.5 align-top text-navy/85";

export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[11px] text-navy/50">{hint}</p> : null}
    </div>
  );
}

export function Pagination({ page, totalPages, buildHref }: { page: number; totalPages: number; buildHref: (page: number) => string }) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Phân trang" className="mt-4 flex items-center justify-between text-sm text-navy/70">
      <span>
        Trang {page}/{totalPages}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <a href={buildHref(page - 1)} className="rounded-lg border border-navy/20 bg-white px-3 py-1.5 hover:border-navy">
            ← Trước
          </a>
        ) : null}
        {page < totalPages ? (
          <a href={buildHref(page + 1)} className="rounded-lg border border-navy/20 bg-white px-3 py-1.5 hover:border-navy">
            Sau →
          </a>
        ) : null}
      </div>
    </nav>
  );
}
