/** Joins conditional class names: cn("a", isB && "b", undefined) -> "a b". */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
