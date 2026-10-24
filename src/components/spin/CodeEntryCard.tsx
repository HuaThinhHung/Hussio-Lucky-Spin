"use client";

import { useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { SpinResultView } from "@/lib/lucky-types";

export type EntryPhase =
  | { name: "entry" }
  | { name: "checking" }
  | { name: "ready"; customerName: string; askNameConsent: boolean }
  | { name: "spinning" }
  | { name: "done"; result: SpinResultView; isHistory: boolean };

type CodeEntryCardProps = {
  /** Pre-filled order number from the link in the order e-mail. */
  initialCode?: string;
  phase: EntryPhase;
  error: string | null;
  consentFullName: boolean;
  onConsentChange: (value: boolean) => void;
  onSubmit: (code: string, contact: string) => void;
  onSpin: () => void;
  onShowResult: () => void;
  onReset: () => void;
};

const inputClass =
  "mt-2 h-12 w-full rounded-md border border-ivory/20 bg-navy-dark/70 px-4 text-base text-ivory placeholder:text-ivory/35 transition focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30 disabled:opacity-60";

export default function CodeEntryCard({
  initialCode = "",
  phase,
  error,
  consentFullName,
  onConsentChange,
  onSubmit,
  onSpin,
  onShowResult,
  onReset,
}: CodeEntryCardProps) {
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [contact, setContact] = useState("");
  const isChecking = phase.name === "checking";
  const formLocked = phase.name !== "entry" && phase.name !== "checking";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isChecking) return;
    onSubmit(code,contact);
  }

  return (
    <div className="code-entry-panel border border-ivory/15 bg-navy p-6 sm:p-8">
      <p className="text-[11px] font-semibold tracking-[0.3em] text-gold">ĐỘC QUYỀN ĐƠN HÀNG WEBSITE</p>
      <h2 id="code-title" className="mt-2 font-display text-2xl font-semibold text-ivory sm:text-3xl">
        XÁC MINH ĐƠN HÀNG
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ivory/70">
        Đơn từ 1.300.000đ. Dùng thông tin đã đặt hàng để mở lượt quay.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" aria-describedby={error ? "code-error" : undefined}>
        <div>
          <label htmlFor="lucky-code" className="text-xs font-semibold tracking-[0.2em] text-ivory/80">
            MÃ ĐƠN HÀNG
          </label>
          <input
            id="lucky-code"
            name="code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="Ví dụ: #1284"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={40}
            required
            disabled={formLocked}
            className={cn(inputClass, "font-mono tracking-wider")}
          />
        </div>


        <div>
          <label htmlFor="order-contact" className="text-xs font-semibold tracking-[0.2em] text-ivory/80">
            SĐT HOẶC EMAIL ĐẶT HÀNG
          </label>
          <input
            id="order-contact"
            name="contact"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            required
            maxLength={160}
            disabled={formLocked}
            className={inputClass}
            placeholder="SĐT hoặc email đã dùng khi đặt hàng"
            autoComplete="tel"
          />
        </div>
        {error ? (
          <p id="code-error" role="alert" className="rounded-md border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold-light">
            {error}
          </p>
        ) : null}

        {phase.name === "entry" || phase.name === "checking" ? (
          <button
            type="submit"
            disabled={isChecking}
            className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-md bg-gold text-sm font-semibold tracking-[0.18em] text-navy-dark transition hover:bg-gold-light disabled:cursor-wait disabled:opacity-80"
          >
            {isChecking ? (
              <>
                <span aria-hidden="true" className="size-4 animate-spin rounded-md border-2 border-navy-dark/30 border-t-navy-dark" />
                Đang kiểm tra đơn hàng...
              </>
            ) : (
              "KIỂM TRA LƯỢT QUAY"
            )}
          </button>
        ) : null}
      </form>

      {phase.name === "ready" || phase.name === "spinning" ? (
        <div className="animate-fade-up mt-6 rounded-2xl border border-gold/50 bg-gold/10 p-5 text-center">
          <p className="text-xs font-semibold tracking-[0.3em] text-gold">ĐƠN HỢP LỆ</p>
          <p className="mt-2 text-lg font-semibold text-ivory">
            {phase.name === "ready" && phase.customerName ? `Chào ${phase.customerName}, bạn` : "Bạn"} có{" "}
            <span className="text-gold-light">01 lượt quay</span>.
          </p>
          {phase.name === "ready" && phase.askNameConsent ? (
            <label className="mt-4 flex items-start gap-3 text-left text-xs leading-relaxed text-ivory/75">
              <input
                type="checkbox"
                checked={consentFullName}
                onChange={(event) => onConsentChange(event.target.checked)}
                className="mt-0.5 size-4 accent-[#C7A15A]"
              />
              Tôi đồng ý hiển thị họ tên đầy đủ trong danh sách người may mắn.
            </label>
          ) : null}
          <button
            type="button"
            onClick={onSpin}
            disabled={phase.name === "spinning"}
            className="mt-5 inline-flex h-13 w-full items-center justify-center rounded-md bg-gold text-sm font-semibold tracking-[0.2em] text-navy-dark shadow-[0_10px_40px_-10px_rgba(217,45,50,0.15)] transition hover:bg-gold-light disabled:cursor-wait disabled:opacity-70"
          >
            {phase.name === "spinning" ? "ĐANG QUAY…" : "QUAY NGAY"}
          </button>
          {phase.name === "ready" ? (
            <button
              type="button"
              onClick={onReset}
              className="mt-3 text-xs text-ivory/60 underline-offset-4 hover:text-ivory hover:underline"
            >
              Dùng đơn khác
            </button>
          ) : null}
        </div>
      ) : null}

      {phase.name === "done" ? (
        <div className="animate-fade-up mt-6 rounded-2xl border border-gold/40 bg-navy-dark/60 p-5 text-center">
          <p className="text-xs font-semibold tracking-[0.3em] text-gold">
            {phase.isHistory ? "ĐƠN NÀY ĐÃ QUAY" : "KẾT QUẢ CỦA BẠN"}
          </p>
          <p className="mt-2 font-display text-xl font-semibold text-ivory">{phase.result.prizeHeadline}</p>
          {phase.result.gift && (phase.result.gift.size || phase.result.gift.color) ? (
            <p className="mt-1 text-sm font-semibold text-gold-light">
              {[phase.result.gift.size && `Size ${phase.result.gift.size}`, phase.result.gift.color].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-ivory/60">
            {formatDateTime(phase.result.spunAt)} · {phase.result.rewardStatusLabel}
          </p>
          {phase.result.voucher ? (
            <p className="mt-2 font-mono text-sm tracking-wider text-gold-light">{phase.result.voucher.code}</p>
          ) : null}
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onShowResult}
              className="inline-flex h-11 items-center sm:flex-1 justify-center rounded-md bg-gold px-4 text-xs font-semibold tracking-[0.18em] text-navy-dark transition hover:bg-gold-light"
            >
              XEM CHI TIẾT
            </button>
            <button
              type="button"
              onClick={() => {
                setCode("");
                onReset();
              }}
              className="inline-flex h-11 items-center justify-center rounded-md border sm:flex-1 border-ivory/25 px-4 text-xs font-semibold tracking-[0.18em] text-ivory transition hover:border-gold hover:text-gold-light"
            >
              NHẬP ĐƠN KHÁC
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
