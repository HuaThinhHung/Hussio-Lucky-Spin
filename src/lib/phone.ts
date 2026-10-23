// Vietnamese phone normalisation + keyed hashing.
// The raw phone number is never stored: only HMAC-SHA256(PHONE_HASH_SECRET, phone)
// and the last 3 digits (for CS to cross-check in admin).
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * "+84 912 345 678", "84912345678", "0912.345.678", "912345678" -> "0912345678".
 * Returns null when the input is not a plausible Vietnamese number (10–11 digits).
 */
export function normalizeVnPhone(raw: string): string | null {
  let digits = raw.normalize("NFKC").replace(/[^\d]/g, "");
  if (digits.startsWith("84") && (digits.length === 11 || digits.length === 12)) {
    digits = `0${digits.slice(2)}`;
  } else if (!digits.startsWith("0") && (digits.length === 9 || digits.length === 10)) {
    digits = `0${digits}`;
  }
  return /^0\d{9,10}$/.test(digits) ? digits : null;
}

export function hashPhoneWithSecret(normalizedPhone: string, secret: string): string {
  return createHmac("sha256", secret).update(`vn-phone:${normalizedPhone}`).digest("hex");
}

export function phoneHint(normalizedPhone: string): string {
  return normalizedPhone.slice(-3);
}

function phoneSecret(): string {
  const secret = process.env.PHONE_HASH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("PHONE_HASH_SECRET must be set (at least 16 characters).");
  }
  return secret;
}

export function hashPhone(normalizedPhone: string): string {
  return hashPhoneWithSecret(normalizedPhone, phoneSecret());
}

/** Constant-time comparison of a typed phone against a stored hash. */
export function phoneMatchesHash(rawPhone: string, storedHash: string): boolean {
  const normalized = normalizeVnPhone(rawPhone);
  if (!normalized) return false;
  const candidate = Buffer.from(hashPhone(normalized), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}
