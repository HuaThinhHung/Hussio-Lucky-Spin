// Customer name privacy for the public winner feed.
//
//   "Hứa Hưng"        -> "Hứa H***"
//   "Nguyễn Văn Nam"  -> "Nguyễn V*** N**"
//
// Rule: family name (first word) is kept, middle names become "X***",
// the given name (last word) keeps its first letter + one "*" per remaining
// letter (minimum two).
import type { WinnerNameMode } from "@/generated/prisma/enums";

const FALLBACK_NAME = "Khách hàng HUSSIO";

function splitWords(fullName: string): string[] {
  return fullName.normalize("NFC").trim().split(/\s+/).filter(Boolean);
}

function capitalize(word: string): string {
  const chars = Array.from(word.toLocaleLowerCase("vi"));
  if (chars.length === 0) return "";
  return chars[0].toLocaleUpperCase("vi") + chars.slice(1).join("");
}

function initial(word: string): string {
  return (Array.from(word)[0] ?? "").toLocaleUpperCase("vi");
}

function maskGivenName(word: string): string {
  const length = Array.from(word).length;
  return initial(word) + "*".repeat(Math.max(length - 1, 2));
}

export function maskName(fullName: string): string {
  const words = splitWords(fullName);
  if (words.length === 0) return FALLBACK_NAME;
  if (words.length === 1) return maskGivenName(words[0]);

  const [familyName, ...rest] = words;
  const masked = rest.map((word, index) =>
    index === rest.length - 1 ? maskGivenName(word) : `${initial(word)}***`,
  );
  return [capitalize(familyName), ...masked].join(" ");
}

/** Vietnamese given name = last word ("Nguyễn Văn Nam" -> "Nam"). */
export function givenName(fullName: string): string {
  const words = splitWords(fullName);
  return words.length ? capitalize(words[words.length - 1]) : FALLBACK_NAME;
}

export function titleCaseName(fullName: string): string {
  const words = splitWords(fullName);
  return words.length ? words.map(capitalize).join(" ") : FALLBACK_NAME;
}

export function publicDisplayName(
  fullName: string,
  mode: WinnerNameMode,
  consentFullName: boolean,
): string {
  switch (mode) {
    case "FIRST_NAME":
      return givenName(fullName);
    case "FULL_NAME_WITH_CONSENT":
      return consentFullName ? titleCaseName(fullName) : maskName(fullName);
    case "MASKED":
    default:
      return maskName(fullName);
  }
}
