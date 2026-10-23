import "server-only";
import { createHash } from "node:crypto";

type HeaderSource = Pick<Headers, "get">;

/** Best-effort client IP (Vercel sets x-forwarded-for / x-real-ip). */
export function getClientIp(headers: HeaderSource): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** IPs are only kept hashed (rate-limit keys), never raw. */
export function hashIp(ip: string): string {
  const pepper = process.env.ADMIN_SESSION_SECRET ?? "hussio-lucky-spin";
  return createHash("sha256").update(`${pepper}:${ip}`).digest("hex").slice(0, 32);
}

function allowedHosts(headers: HeaderSource): Set<string> {
  const hosts = new Set<string>();
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (host) hosts.add(host.toLowerCase());
  const appUrl = process.env.APP_URL;
  if (appUrl) {
    try {
      hosts.add(new URL(appUrl).host.toLowerCase());
    } catch {
      // ignore malformed APP_URL
    }
  }
  return hosts;
}

/**
 * CSRF guard for JSON route handlers: browsers always send Origin on
 * cross-site POSTs, so a present-but-foreign Origin is rejected.
 */
export function isSameOriginRequest(headers: HeaderSource): boolean {
  const origin = headers.get("origin");
  if (!origin) return true;
  try {
    return allowedHosts(headers).has(new URL(origin).host.toLowerCase());
  } catch {
    return false;
  }
}

/** Strips control characters and collapses whitespace from free text. */
export function sanitizeText(value: string, maxLength: number): string {
  return value
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}
