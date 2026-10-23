// Browser-side API helpers for the customer flow.
import type { ClientAnalyticsEventName } from "@/lib/constants";
import {
  luckyError,
  type ConfirmRewardResponse,
  type LuckyError,
  type SpinResponse,
  type ValidateResponse,
} from "@/lib/lucky-types";

type ScriptRunner = {
  withSuccessHandler(handler: (value: unknown) => void): ScriptRunner;
  withFailureHandler(handler: () => void): ScriptRunner;
  customerRequest(action: string, body: unknown): void;
};
async function postJson<T extends { ok: boolean }>(url: string, body: unknown): Promise<T | LuckyError> {
  const bridge = (window as Window & { google?: { script?: { run?: ScriptRunner } } }).google?.script?.run;
  if (!bridge) return luckyError("CAMPAIGN_NOT_STARTED");
  return new Promise(resolve => {
    const timer = window.setTimeout(() => resolve(luckyError("NETWORK")), 30000);
    bridge.withSuccessHandler(value => { clearTimeout(timer); resolve(value as T); })
      .withFailureHandler(() => { clearTimeout(timer); resolve(luckyError("SERVER_ERROR")); })
      .customerRequest(url.split("/").pop()!, body);
  });
}

export type Credentials = { code: string };

export function validateCode(credentials: Credentials) {
  return postJson<ValidateResponse>("/api/lucky/validate", credentials);
}

export function requestSpin(credentials: Credentials & { consentFullName: boolean }) {
  return postJson<SpinResponse>("/api/lucky/spin", credentials);
}

export function confirmReward(credentials: Credentials & { size: string; note: string }) {
  return postJson<ConfirmRewardResponse>("/api/lucky/confirm", credentials);
}

/** Fire-and-forget analytics (voucher_copied, shop_now_clicked). */
export function sendClientEvent(name: ClientAnalyticsEventName, placement?: string): void {
  // No analytics endpoint in the Google-hosted version.
  void name; void placement;
}

/** Copies text with the async clipboard API, falling back to execCommand. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}

export const WINNER_EVENT = "hussio:new-winner";
