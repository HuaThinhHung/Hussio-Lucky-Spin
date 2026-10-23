import "server-only";
import { NextResponse } from "next/server";
import { luckyError } from "@/lib/lucky-types";
import { consumeRateLimit, RATE_LIMITS } from "@/server/security/rate-limit";
import { getClientIp, hashIp, isSameOriginRequest } from "@/server/security/request";

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_JSON_BYTES = 4096;

export function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json(data, { status, headers: { ...NO_STORE, ...headers } });
}

/** Reads a small JSON body; returns null for invalid / oversized payloads. */
export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await request.text();
    if (text.length > MAX_JSON_BYTES) return null;
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Same-origin + per-IP rate limit for public POST endpoints. Returns an error response or null. */
export async function guardPublicPost(
  request: Request,
  bucket: keyof typeof RATE_LIMITS,
): Promise<NextResponse | null> {
  if (!isSameOriginRequest(request.headers)) {
    return jsonResponse(luckyError("VALIDATION"), 403);
  }
  const { limit, windowSeconds } = RATE_LIMITS[bucket];
  const ipKey = hashIp(getClientIp(request.headers));
  const result = await consumeRateLimit(`${bucket}:ip:${ipKey}`, limit, windowSeconds);
  if (!result.allowed) {
    return jsonResponse(luckyError("RATE_LIMITED"), 429, { "Retry-After": String(result.retryAfterSeconds) });
  }
  return null;
}

export function stringField(body: Record<string, unknown> | null, key: string, maxLength = 64): string {
  const value = body?.[key];
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}
