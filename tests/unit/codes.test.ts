import { describe, expect, it } from "vitest";
import {
  CODE_ALPHABET,
  generateLuckyCode,
  generateVoucherCode,
  isPlausibleCode,
  normalizeCodeInput,
} from "@/lib/codes";

describe("lucky code generation", () => {
  it("uses the HUSSIO-BF26-XXXXXX format with a safe alphabet", () => {
    const code = generateLuckyCode();
    expect(code).toMatch(/^HUSSIO-BF26-[A-Z2-9]{12}$/);
    for (const char of code.slice("HUSSIO-BF26-".length)) expect(CODE_ALPHABET).toContain(char);
    expect(CODE_ALPHABET).not.toMatch(/[01IO]/);
  });

  it("is random, not sequential (10k codes, no duplicates)", () => {
    const codes = new Set(Array.from({ length: 10_000 }, () => generateLuckyCode()));
    expect(codes.size).toBe(10_000);
  });

  it("generates voucher codes like HUSSIO-WHEEL-X9K2M7", () => {
    expect(generateVoucherCode()).toMatch(/^HUSSIO-WHEEL-[A-Z2-9]{6}$/);
  });

  it("normalises what customers type", () => {
    expect(normalizeCodeInput(" hussio-bf26-a7k2m9 ")).toBe("HUSSIO-BF26-A7K2M9");
    expect(normalizeCodeInput("hussio bf26 a7k2m9")).toBe("HUSSIO-BF26-A7K2M9");
    expect(normalizeCodeInput("HUSSIOBF26A7K2M9")).toBe("HUSSIO-BF26-A7K2M9");
    expect(isPlausibleCode(normalizeCodeInput("HUSSIOBF26A7K2M9"))).toBe(true);
    expect(isPlausibleCode("hello")).toBe(false);
  });
});
