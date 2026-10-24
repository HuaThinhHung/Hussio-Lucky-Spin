"use client";

import { useEffect, useRef, useState } from "react";
import TrackedShopLink from "@/components/home/TrackedShopLink";
import { copyToClipboard, type Credentials } from "@/components/spin/api";
import SizeConfirmForm from "@/components/spin/SizeConfirmForm";
import VoucherCodeBox from "@/components/spin/VoucherCodeBox";
import { formatDateTime } from "@/lib/format";
import type { SpinResultView, WebGiftView } from "@/lib/lucky-types";

type ResultModalProps = {
  open: boolean;
  result: SpinResultView | null;
  /** True when re-opening an earlier spin ("ĐƠN NÀY ĐÃ QUAY"). */
  isHistory: boolean;
  credentials: Credentials | null;
  shopUrl: string;
  /** Zalo OA link; empty hides the button. */
  contactUrl?: string;
  onClose: () => void;
  onResultUpdate: (result: SpinResultView) => void;
};

/** Website flow: what was reserved for the order, and what happens next. */
function WebGiftSummary({ result, gift, contactUrl }: { result: SpinResultView; gift: WebGiftView; contactUrl: string }) {
  const [copied, setCopied] = useState(false);
  const details = [gift.size && `Size ${gift.size}`, gift.color].filter(Boolean) as string[];
  const isVoid = result.rewardStatus === "VOID";
  const next = isVoid
    ? "Quà của đơn này đã được huỷ (đơn huỷ hoặc hoàn). Vui lòng nhắn HUSSIO nếu cần hỗ trợ."
    : result.rewardStatus === "FULFILLED"
      ? "Quà đã được đóng gói gửi kèm đơn hàng của bạn."
      : result.prizeType === "VOUCHER"
        ? "Ưu đãi đã được ghi nhận theo đơn hàng. HUSSIO sẽ xác nhận cách áp dụng khi liên hệ với bạn."
        : gift.packWithOrder
          ? "Quà đã được ghi nhận và sẽ được đóng gói gửi kèm đơn hàng. Bạn không cần làm gì thêm."
          : "Đơn hàng đã được gửi đi trước lúc quay. HUSSIO sẽ liên hệ để gửi quà riêng cho bạn.";
  const summary = [
    `HUSSIO Lucky Spin — đơn ${result.orderName ?? ""}`.trim(),
    `Quà: ${gift.name}${details.length ? ` (${details.join(", ")})` : ""}`,
    gift.sku ? `SKU: ${gift.sku}` : "",
    `Quay lúc: ${formatDateTime(result.spunAt)}`,
  ].filter(Boolean).join("\n");

  return (
    <div className="space-y-3">
      {details.length ? (
        <div className="flex flex-wrap justify-center gap-2">
          {details.map((detail) => (
            <span key={detail} className="rounded-full border border-gold/50 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-gold-light">
              {detail}
            </span>
          ))}
        </div>
      ) : null}
      {result.orderName ? (
        <p className="text-sm text-ivory/80">
          Đơn hàng <strong className="text-ivory">{result.orderName}</strong>
        </p>
      ) : null}
      <p className="text-sm leading-relaxed text-ivory/80">{next}</p>
      {contactUrl && !isVoid ? (
        <>
          {/* A real link (not window.open) so popup blockers and the Apps Script iframe allow it. */}
          <a
            href={contactUrl}
            target="_blank"
            rel="noopener"
            onClick={() => {
              void copyToClipboard(summary).then(setCopied);
            }}
            className="inline-flex h-12 w-full items-center justify-center rounded-md bg-gold text-sm font-semibold tracking-[0.18em] text-navy-dark transition hover:bg-gold-light"
          >
            NHẮN ZALO HUSSIO
          </a>
          <p className="text-xs text-ivory/55" aria-live="polite">
            {copied ? "Đã sao chép thông tin quà — dán vào Zalo để CS kiểm tra nhanh." : "Bấm để sao chép thông tin quà và mở Zalo HUSSIO."}
          </p>
        </>
      ) : null}
    </div>
  );
}

/**
 * Native <dialog> + showModal(): focus is trapped, the page behind is inert,
 * Esc closes, and focus returns to the trigger on close.
 */
export default function ResultModal({
  open,
  result,
  isHistory,
  credentials,
  shopUrl,
  contactUrl = "",
  onClose,
  onResultUpdate,
}: ResultModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [showSizeForm, setShowSizeForm] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!result) return <dialog ref={dialogRef} className="result-dialog" onClose={onClose} />;

  const isProduct = result.prizeType === "PRODUCT_POOL";
  const rewardLocked = result.rewardStatus !== "WON";
  const isVoid = result.rewardStatus === "VOID";

  return (
    <dialog
      ref={dialogRef}
      className="result-dialog"
      aria-labelledby="result-title"
      onClose={() => {
        setShowSizeForm(false);
        onClose();
      }}
    >
      <div className="relative overflow-hidden rounded-md border border-ivory/20 bg-navy p-6 text-center text-ivory shadow-2xl sm:p-8">

        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Đóng"
          className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-full text-ivory/60 transition hover:bg-ivory/10 hover:text-ivory"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>

        <div className="relative">
          {isHistory ? (
            <p className="text-[11px] font-semibold tracking-[0.3em] text-gold">ĐƠN NÀY ĐÃ QUAY</p>
          ) : null}
          <h2 id="result-title" className="mt-2 font-display text-3xl font-semibold text-ivory">
            {isVoid ? "PHẦN THƯỞNG ĐÃ HUỶ" : "🎉 CHÚC MỪNG!"}
          </h2>
          <p className="mt-4 text-sm text-ivory/70">Bạn nhận được</p>
          <p className="mt-2 font-display text-2xl font-semibold leading-snug text-ivory sm:text-[1.7rem]">
            {result.prizeHeadline}
          </p>

          <dl className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-ivory/60">
            <div className="flex gap-1">
              <dt>Ngày quay:</dt>
              <dd className="text-ivory/85">{formatDateTime(result.spunAt)}</dd>
            </div>
            <div className="flex gap-1">
              <dt>Trạng thái:</dt>
              <dd className="text-ivory/85">{result.rewardStatusLabel}</dd>
            </div>
          </dl>

          <div className="mt-6 space-y-4">
            {result.gift ? <WebGiftSummary result={result} gift={result.gift} contactUrl={contactUrl} /> : null}
            {result.voucher && !isVoid ? <VoucherCodeBox voucher={result.voucher} /> : null}

            {isProduct && !isVoid && !result.gift ? (
              <>
                <p className="text-sm leading-relaxed text-ivory/80">
                  Giữ mã quay và đưa kết quả này cho nhân viên HUSSIO để nhận quà. Mẫu, màu và kích thước theo tồn kho thực tế.
                </p>
                {result.product && credentials ? (
                  showSizeForm || result.product.customerConfirmed ? (
                    <SizeConfirmForm
                      product={result.product}
                      credentials={credentials}
                      locked={rewardLocked}
                      onConfirmed={onResultUpdate}
                    />
                  ) : !rewardLocked ? (
                    <button
                      type="button"
                      onClick={() => setShowSizeForm(true)}
                      className="inline-flex h-12 w-full items-center justify-center rounded-md bg-gold text-sm font-semibold tracking-[0.18em] text-navy-dark transition hover:bg-gold-light"
                    >
                      XÁC NHẬN THÔNG TIN
                    </button>
                  ) : null
                ) : null}
              </>
            ) : null}

            {isVoid && !result.gift ? (
              <p className="text-sm leading-relaxed text-ivory/75">
                Phần thưởng này không còn hiệu lực (đơn hàng bị huỷ hoặc hoàn). Vui lòng liên hệ HUSSIO nếu cần hỗ trợ.
              </p>
            ) : null}

            {!isProduct || isVoid ? (
              <TrackedShopLink
                href={shopUrl}
                placement="result_modal"
                className="inline-flex h-12 w-full items-center justify-center rounded-md bg-gold text-sm font-semibold tracking-[0.18em] text-navy-dark transition hover:bg-gold-light"
              >
                TIẾP TỤC MUA SẮM
              </TrackedShopLink>
            ) : (
              <TrackedShopLink
                href={shopUrl}
                placement="result_modal"
                className="inline-flex h-11 w-full items-center justify-center rounded-md border border-ivory/25 text-xs font-semibold tracking-[0.18em] text-ivory transition hover:border-gold hover:text-gold-light"
              >
                TIẾP TỤC MUA SẮM
              </TrackedShopLink>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
