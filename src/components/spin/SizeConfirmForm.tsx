"use client";

import { useState, type FormEvent } from "react";
import { confirmReward, type Credentials } from "@/components/spin/api";
import { cn } from "@/lib/cn";
import type { ProductRewardView, SpinResultView } from "@/lib/lucky-types";

type SizeConfirmFormProps = {
  product: ProductRewardView;
  credentials: Credentials;
  locked: boolean;
  onConfirmed: (result: SpinResultView) => void;
};

/** "XÁC NHẬN THÔNG TIN": winner picks a size (only in-stock sizes when known). */
export default function SizeConfirmForm({ product, credentials, locked, onConfirmed }: SizeConfirmFormProps) {
  const [size, setSize] = useState(product.sizePreference ?? "");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (product.customerConfirmed && product.sizePreference) {
    return (
      <p className="rounded-xl border border-gold/30 bg-gold/10 p-4 text-sm leading-relaxed text-ivory/85">
        Đã ghi nhận size <strong className="text-gold-light">{product.sizePreference}</strong>. HUSSIO sẽ liên hệ để xác
        nhận quà và kích thước.
      </p>
    );
  }
  if (locked) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!size || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    const response = await confirmReward({ ...credentials, size, note });
    setIsSubmitting(false);
    if (response.ok) onConfirmed(response.result);
    else setError(response.message);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      <fieldset>
        <legend className="text-xs font-semibold tracking-[0.2em] text-ivory/70">CHỌN SIZE MONG MUỐN</legend>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {product.sizeOptions.map((option) => (
            <label
              key={option}
              className={cn(
                "flex h-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold-light",
                size === option ? "border-gold bg-gold text-navy-dark" : "border-ivory/25 text-ivory hover:border-gold/70",
              )}
            >
              <input
                type="radio"
                name="size"
                value={option}
                checked={size === option}
                onChange={() => setSize(option)}
                className="sr-only"
              />
              {option}
            </label>
          ))}
        </div>
        {!product.sizeStockKnown ? (
          <p className="mt-2 text-xs text-ivory/55">Size là nguyện vọng — HUSSIO xác nhận theo tồn kho quà tặng thực tế.</p>
        ) : null}
      </fieldset>

      <div>
        <label htmlFor="reward-note" className="text-xs font-semibold tracking-[0.2em] text-ivory/70">
          GHI CHÚ (KHÔNG BẮT BUỘC)
        </label>
        <textarea
          id="reward-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={300}
          rows={2}
          placeholder="Ví dụ: màu yêu thích, thời gian liên hệ…"
          className="mt-2 w-full rounded-lg border border-ivory/20 bg-navy-dark/60 px-3 py-2 text-sm text-ivory placeholder:text-ivory/35 focus:border-gold focus:outline-none"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-gold-light">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!size || isSubmitting}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-gold text-sm font-semibold tracking-[0.18em] text-navy-dark transition hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "ĐANG GỬI…" : "GỬI XÁC NHẬN"}
      </button>
    </form>
  );
}
