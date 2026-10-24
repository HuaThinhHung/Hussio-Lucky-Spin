// Browser-side API helpers for the customer flow.
// Two transports to the Google Apps Script backend:
//  - inside the Apps Script web app: google.script.run
//  - on another host (quay.hussio-vn.com): POST to NEXT_PUBLIC_SHEET_API_URL (the web app's /exec URL)
import type { ClientAnalyticsEventName } from "@/lib/constants";
import {
  luckyError,
  type CatalogResponse,
  type ConfirmRewardResponse,
  type LuckyError,
  type SpinResponse,
  type ValidateResponse,
} from "@/lib/lucky-types";

type ScriptRunner = {
  withSuccessHandler(handler: (value: unknown) => void): ScriptRunner;
  withFailureHandler(handler: () => void): ScriptRunner;
  customerOrderRequest(action: string, body: unknown): void;
  customerCatalog(): void;
};
type ScriptBridge = {
  run?: ScriptRunner;
  url?: { getLocation(callback: (location: { parameter?: Record<string, string> }) => void): void };
};

const SHEET_API_URL = process.env.NEXT_PUBLIC_SHEET_API_URL ?? "";
const TIMEOUT_MS = 30000;

function scriptBridge(): ScriptBridge | undefined {
  return (window as Window & { google?: { script?: ScriptBridge } }).google?.script;
}

async function callServer<T extends { ok: boolean }>(action: "catalog" | "validate" | "spin", body: object = {}): Promise<T | LuckyError> {
  const runner = scriptBridge()?.run;
  if (runner) {
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => resolve(luckyError("NETWORK")), TIMEOUT_MS);
      const call = runner
        .withSuccessHandler((value) => {
          clearTimeout(timer);
          resolve(value as T);
        })
        .withFailureHandler(() => {
          clearTimeout(timer);
          resolve(luckyError("SERVER_ERROR"));
        });
      if (action === "catalog") call.customerCatalog();
      else call.customerOrderRequest(action, body);
    });
  }
  if (!SHEET_API_URL) return luckyError("CAMPAIGN_NOT_STARTED");
  try {
    // text/plain keeps this a "simple" CORS request: Apps Script cannot answer a preflight.
    const response = await fetch(SHEET_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...body, action }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return luckyError("SERVER_ERROR");
    return (await response.json()) as T;
  } catch {
    return luckyError("NETWORK");
  }
}

export type Credentials = { code: string; contact?: string; top?: string; pants?: string };

export function loadCatalog() {
  return callServer<CatalogResponse>("catalog");
}

export function validateCode(credentials: Credentials) {
  return callServer<ValidateResponse>("validate", credentials);
}

export function requestSpin(credentials: Credentials & { consentFullName: boolean }) {
  return callServer<SpinResponse>("spin", credentials);
}

/** Size confirmation after the spin is not used by the website flow (size is chosen before spinning). */
export async function confirmReward(credentials: Credentials & { size: string; note: string }): Promise<ConfirmRewardResponse> {
  void credentials;
  return luckyError("NOT_PRODUCT_PRIZE");
}

/** Query parameters of the page URL (?order=1284), also when running inside the Apps Script iframe. */
export function readLaunchParams(): Promise<Record<string, string>> {
  const url = scriptBridge()?.url;
  if (url) return new Promise((resolve) => url.getLocation((location) => resolve(location.parameter ?? {})));
  return Promise.resolve(Object.fromEntries(new URLSearchParams(window.location.search)));
}

/** Fire-and-forget analytics (voucher_copied, shop_now_clicked). */
export function sendClientEvent(name: ClientAnalyticsEventName, placement?: string): void {
  // No analytics endpoint in the Google-hosted version.
  void name;
  void placement;
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
