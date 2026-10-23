// Secure, non-sequential code generation for lucky codes and vouchers.
import { randomInt as cryptoRandomInt } from "node:crypto";
import type { RandomIntFn } from "@/lib/weighted-random";

/** 32 characters, without look-alikes (0/O, 1/I). 32^6 ≈ 1.07 billion combinations. */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const RANDOM_PART_LENGTH = 12;
export const DEFAULT_CODE_PREFIX = "HUSSIO-BF26";
export const VOUCHER_CODE_PREFIX = "HUSSIO-WHEEL";

export function randomToken(length: number = RANDOM_PART_LENGTH, randomInt: RandomIntFn = cryptoRandomInt): string {
  let token = "";
  for (let i = 0; i < length; i += 1) {
    token += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return token;
}

/** HUSSIO-BF26-A7K2M9 */
export function generateLuckyCode(prefix: string = DEFAULT_CODE_PREFIX, randomInt?: RandomIntFn): string {
  return `${prefix}-${randomToken(RANDOM_PART_LENGTH, randomInt)}`;
}

/** HUSSIO-WHEEL-X9K2M7 */
export function generateVoucherCode(randomInt?: RandomIntFn): string {
  return `${VOUCHER_CODE_PREFIX}-${randomToken(6, randomInt)}`;
}

/**
 * Normalises what a customer types: case, spaces, missing dashes.
 *   " hussio bf26 a7k2m9 " -> "HUSSIO-BF26-A7K2M9"
 *   "HUSSIOBF26A7K2M9"     -> "HUSSIO-BF26-A7K2M9"
 */
export function normalizeCodeInput(raw: string): string {
  const normalized = raw.normalize("NFKC").toUpperCase().replace(/\s+/g, "");
  if (isPlausibleCode(normalized)) return normalized;
  const compact = raw.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = /^([A-Z]{2,12}?)([A-Z0-9]{4})([A-Z0-9]{12}|[A-Z0-9]{6})$/.exec(compact);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return raw.normalize("NFKC").toUpperCase().replace(/\s+/g, "").slice(0, 40);
}

export function isPlausibleCode(code: string): boolean {
  return /^[A-Z]{2,12}-[A-Z0-9]{4}-[A-Z0-9]{6,12}$/.test(code);
}
