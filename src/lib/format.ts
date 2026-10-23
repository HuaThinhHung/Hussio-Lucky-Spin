// Formatting helpers (VND, dates, relative time) — Vietnamese locale.

const VN_TIMEZONE = "Asia/Ho_Chi_Minh";

const vndNumber = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

/** 1300000 -> "1.300.000đ" */
export function formatVnd(amount: number): string {
  return `${vndNumber.format(Math.round(amount))}đ`;
}

/** 100000 -> "100K", 1300000 -> "1.3TR" */
export function formatVndShort(amount: number): string {
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}TR`;
  }
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}K`;
  return String(amount);
}

/** Parses "1.300.000", "1,300,000đ", "1300000" -> 1300000. Returns null when no digits. */
export function parseVndInput(raw: string | number | null | undefined): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.round(raw) : null;
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const value = Number.parseInt(digits, 10);
  return Number.isSafeInteger(value) ? value : null;
}

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: VN_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: VN_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatDateTime(value: Date | string): string {
  return dateTimeFormatter.format(new Date(value));
}

export function formatDate(value: Date | string): string {
  return dateFormatter.format(new Date(value));
}

/** "vừa xong", "3 phút trước", "2 giờ trước", "4 ngày trước" */
export function formatRelativeTime(value: Date | string, now: Date = new Date()): string {
  const diffSeconds = Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 1000));
  if (diffSeconds < 60) return "vừa xong";
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return formatDate(value);
}

/** Value for <input type="datetime-local"> in Vietnam time. */
export function toDateTimeLocalValue(value: Date | null | undefined): string {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(value);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/** Parses a datetime-local value entered in Vietnam time (UTC+7, no DST). */
export function fromDateTimeLocalValue(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d, hh, mm] = match;
  const date = new Date(`${y}-${m}-${d}T${hh}:${mm}:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatPercent(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) return "0%";
  return `${(value * 100).toFixed(fractionDigits).replace(/\.0+$/, "")}%`;
}
