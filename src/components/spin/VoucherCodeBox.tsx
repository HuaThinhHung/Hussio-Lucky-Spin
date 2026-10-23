"use client";

import { useState } from "react";
import { copyToClipboard, sendClientEvent } from "@/components/spin/api";
import { formatDate, formatVnd } from "@/lib/format";
import type { VoucherView } from "@/lib/lucky-types";

type VoucherCodeBoxProps = { voucher: VoucherView };

const VOUCHER_STATUS_NOTE: Partial<Record<VoucherView["status"], string>> = {
  REDEEMED: "Voucher đã được sử dụng.",
  EXPIRED: "Voucher đã hết hạn.",
  VOID: "Voucher đã bị huỷ.",
};

export default function VoucherCodeBox({ voucher }: VoucherCodeBoxProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyToClipboard(voucher.code);
    if (!ok) return;
    setCopied(true);
    sendClientEvent("voucher_copied", "result");
    window.setTimeout(() => setCopied(false), 2500);
  }

  const statusNote = VOUCHER_STATUS_NOTE[voucher.status];

  return (
    <div className="rounded-xl border border-dashed border-gold/60 bg-navy-dark/70 p-4 text-left">
      <p className="text-[11px] font-semibold tracking-[0.25em] text-ivory/60">MÃ VOUCHER</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <code className="break-all font-mono text-lg font-semibold tracking-wider text-gold-light sm:text-xl">{voucher.code}</code>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex h-10 items-center rounded-full border border-gold px-4 text-xs font-semibold tracking-[0.15em] text-gold-light transition hover:bg-gold hover:text-navy-dark"
        >
          {copied ? "ĐÃ SAO CHÉP ✓" : "SAO CHÉP MÃ"}
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? "Đã sao chép mã voucher" : ""}
      </span>
      <ul className="mt-3 space-y-1 text-xs leading-relaxed text-ivory/70">
        <li>Áp dụng cho đơn hàng tiếp theo tại hussio.com.</li>
        {voucher.minimumSpend ? <li>Đơn tối thiểu {formatVnd(voucher.minimumSpend)}.</li> : null}
        <li>Hạn sử dụng đến {formatDate(voucher.expiresAt)}. Dùng 01 lần.</li>
      </ul>
      {statusNote ? <p className="mt-2 text-xs font-semibold text-gold-light">{statusNote}</p> : null}
    </div>
  );
}
