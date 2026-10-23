"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import { createCodeAction } from "@/app/admin/_actions/codes";
import CopyButton from "@/components/admin/CopyButton";
import { FormPendingContext } from "@/components/admin/form-pending";
import SubmitButton from "@/components/admin/SubmitButton";
import { Card, Field, inputClass } from "@/components/admin/ui";
import { buildCustomerMessage, CHANNEL_LABELS } from "@/lib/constants";
import { formatVnd } from "@/lib/format";

type CreateCodeFormProps = { minimumOrderValue: number };

export default function CreateCodeForm({ minimumOrderValue }: CreateCodeFormProps) {
  const [state, formAction, isPending] = useActionState(createCodeAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const createdCode = state?.ok ? String(state.data?.code ?? "") : "";

  // Clear the form only after success; on errors staff keep what they typed.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <FormPendingContext.Provider value={isPending}>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <Field label="Tên khách hàng" htmlFor="customerName">
            <input id="customerName" name="customerName" required maxLength={80} className={inputClass} placeholder="Nguyễn Văn Nam" />
          </Field>
          <Field label="Số điện thoại" htmlFor="phone" hint="Khách dùng SĐT này để quay. Hệ thống chỉ lưu dạng mã hoá.">
            <input id="phone" name="phone" type="tel" inputMode="tel" required maxLength={20} className={inputClass} placeholder="0912345678" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mã đơn / Mã bill" htmlFor="orderReference">
              <input id="orderReference" name="orderReference" required maxLength={64} className={inputClass} placeholder="FB-10234" />
            </Field>
            <Field label="Giá trị đơn (VNĐ)" htmlFor="orderValue" hint={`Tối thiểu ${formatVnd(minimumOrderValue)}`}>
              <input id="orderValue" name="orderValue" inputMode="numeric" required className={inputClass} placeholder="1.300.000" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kênh" htmlFor="channel">
              <select id="channel" name="channel" required defaultValue="FACEBOOK" className={inputClass}>
                {(Object.keys(CHANNEL_LABELS) as (keyof typeof CHANNEL_LABELS)[]).map((channel) => (
                  <option key={channel} value={channel}>
                    {channel} — {CHANNEL_LABELS[channel]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tỉnh / Thành phố (không bắt buộc)" htmlFor="customerCity" hint="Hiển thị ở mục Người may mắn.">
              <input id="customerCity" name="customerCity" maxLength={60} className={inputClass} placeholder="TP. Hồ Chí Minh" />
            </Field>
          </div>

          {state && !state.ok ? (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.message}
            </p>
          ) : null}

          <SubmitButton pendingLabel="Đang tạo…" className="w-full">
            TẠO MÃ QUAY
          </SubmitButton>
        </form>
        </FormPendingContext.Provider>
      </Card>

      <Card title="Mã vừa tạo">
        {createdCode ? (
          <div aria-live="polite" className="space-y-4">
            <div className="rounded-xl border border-dashed border-gold bg-gold/10 p-5 text-center">
              <p className="text-xs font-semibold tracking-widest text-navy/60">MÃ LUCKY SPIN</p>
              <p className="mt-2 font-mono text-2xl font-bold tracking-wider text-navy">{createdCode}</p>
              <p className="mt-2 text-xs text-navy/60">
                {String(state?.data?.customerName ?? "")} · {String(state?.data?.orderReference ?? "")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={createdCode} label="SAO CHÉP CODE" className="h-10 px-4 text-sm" />
              <CopyButton
                text={buildCustomerMessage(createdCode)}
                label="GỬI CHO KHÁCH (copy tin nhắn)"
                copiedLabel="Đã copy tin nhắn ✓"
                className="h-10 px-4 text-sm"
              />
            </div>
            <pre className="whitespace-pre-wrap rounded-xl bg-navy/[0.04] p-4 text-xs leading-relaxed text-navy/80">
              {buildCustomerMessage(createdCode)}
            </pre>
          </div>
        ) : (
          <p className="text-sm text-navy/60">Mã quay sẽ hiển thị ở đây sau khi tạo, kèm tin nhắn mẫu để gửi khách qua Facebook / Zalo.</p>
        )}
      </Card>
    </div>
  );
}
