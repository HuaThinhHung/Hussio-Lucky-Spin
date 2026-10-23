import "server-only";
import { after } from "next/server";

/**
 * Runs slow side effects (Shopify API calls) after the HTTP response is sent.
 * Outside a Next.js request (scripts, tests) it simply runs detached.
 */
export function runInBackground(label: string, task: () => Promise<void>): void {
  const guarded = async () => {
    try {
      await task();
    } catch (error) {
      console.error(`[background:${label}]`, error);
    }
  };
  try {
    after(guarded);
  } catch {
    void guarded();
  }
}
