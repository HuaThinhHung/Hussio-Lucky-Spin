import { describe, expect, it } from "vitest";
import { maskName, publicDisplayName } from "@/lib/name-mask";
import { hashPhone, hashPhoneWithSecret, normalizeVnPhone, phoneHint, phoneMatchesHash } from "@/lib/phone";

describe("Vietnamese phone normalisation", () => {
  it.each([
    ["0912345678", "0912345678"],
    ["0912 345 678", "0912345678"],
    ["0912.345.678", "0912345678"],
    ["+84 912 345 678", "0912345678"],
    ["84912345678", "0912345678"],
    ["912345678", "0912345678"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeVnPhone(input)).toBe(expected);
  });

  it("rejects garbage", () => {
    expect(normalizeVnPhone("12345")).toBeNull();
    expect(normalizeVnPhone("abc")).toBeNull();
  });
});

describe("phone hashing", () => {
  it("never returns the raw number and is keyed", () => {
    const hash = hashPhone("0912345678");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("0912345678");
    expect(hashPhoneWithSecret("0912345678", "another-secret-value")).not.toBe(hash);
    expect(phoneHint("0912345678")).toBe("678");
  });

  it("matches formatting variants and rejects other numbers", () => {
    const stored = hashPhone("0912345678");
    expect(phoneMatchesHash("+84 912 345 678", stored)).toBe(true);
    expect(phoneMatchesHash("0912345679", stored)).toBe(false);
    expect(phoneMatchesHash("not a phone", stored)).toBe(false);
  });
});

describe("winner name masking", () => {
  it("follows the brief examples", () => {
    expect(maskName("Hứa Hưng")).toBe("Hứa H***");
    expect(maskName("Nguyễn Văn Nam")).toBe("Nguyễn V*** N**");
  });

  it("handles casing, single names and blanks", () => {
    expect(maskName("  trần   minh ")).toBe("Trần M***");
    expect(maskName("Hưng")).toBe("H***");
    expect(maskName("")).toBe("Khách hàng HUSSIO");
  });

  it("respects winnerNameMode", () => {
    expect(publicDisplayName("Nguyễn Văn Nam", "MASKED", true)).toBe("Nguyễn V*** N**");
    expect(publicDisplayName("Nguyễn Văn Nam", "FIRST_NAME", false)).toBe("Nam");
    expect(publicDisplayName("Nguyễn Văn Nam", "FULL_NAME_WITH_CONSENT", false)).toBe("Nguyễn V*** N**");
    expect(publicDisplayName("nguyễn văn nam", "FULL_NAME_WITH_CONSENT", true)).toBe("Nguyễn Văn Nam");
  });
});
