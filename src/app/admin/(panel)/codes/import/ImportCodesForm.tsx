"use client";

import { useActionState, useMemo } from "react";
import { importCodesAction } from "@/app/admin/_actions/codes";
import CopyButton from "@/components/admin/CopyButton";
import SubmitButton from "@/components/admin/SubmitButton";
import { Badge, Card, Field, inputClass, tableClass, tdClass, thClass } from "@/components/admin/ui";

type ImportRow = { row: number; orderReference: string; customerName: string; ok: boolean; code?: string; message: string };

const SAMPLE = `customer_name,phone,order_reference,order_value,channel
Nguyễn Văn Nam,0912345678,FB-10234,1450000,FACEBOOK
Trần Minh,0987654321,BILL-0091,1300000,STORE`;

export default function ImportCodesForm() {
  const [state, formAction] = useActionState(importCodesAction, null);
  const rows = useMemo<ImportRow[]>(() => {
    try {
      return state?.data?.report ? (JSON.parse(String(state.data.report)) as ImportRow[]) : [];
    } catch {
      return [];
    }
  }, [state]);
  const createdCodes = rows.filter((row) => row.ok && row.code).map((row) => `${row.orderReference},${row.customerName},${row.code}`);

  return (
    <div className="space-y-6">
      <Card>
        <form action={formAction} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="File CSV (UTF-8)" htmlFor="file" hint="Cột bắt buộc: customer_name, phone, order_reference, order_value, channel. Tuỳ chọn: city.">
              <input id="file" name="file" type="file" accept=".csv,text/csv" className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-navy file:px-3 file:py-2 file:text-ivory" />
            </Field>
            <Field label="Kênh mặc định (nếu file không có cột channel)" htmlFor="defaultChannel">
              <select id="defaultChannel" name="defaultChannel" defaultValue="" className={inputClass}>
                <option value="">— Bắt buộc có cột channel —</option>
                <option value="FACEBOOK">FACEBOOK</option>
                <option value="STORE">STORE</option>
                <option value="SHOPIFY_WEB">SHOPIFY_WEB</option>
              </select>
            </Field>
          </div>
          <Field label="…hoặc dán nội dung CSV" htmlFor="csvText">
            <textarea id="csvText" name="csvText" rows={6} placeholder={SAMPLE} className={`${inputClass} h-auto py-2 font-mono text-xs`} />
          </Field>
          {state ? (
            <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm font-semibold text-emerald-700" : "text-sm font-semibold text-red-700"}>
              {state.message}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <SubmitButton pendingLabel="Đang import…">IMPORT &amp; TẠO MÃ</SubmitButton>
            <CopyButton text={SAMPLE} label="Copy CSV mẫu" className="h-10 px-4 text-sm" />
          </div>
        </form>
      </Card>

      {rows.length > 0 ? (
        <Card title="Kết quả import">
          {createdCodes.length > 0 ? (
            <div className="mb-3">
              <CopyButton text={createdCodes.join("\n")} label={`Copy ${createdCodes.length} mã đã tạo`} className="h-10 px-4 text-sm" />
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Dòng</th>
                  <th className={thClass}>Đơn</th>
                  <th className={thClass}>Khách</th>
                  <th className={thClass}>Kết quả</th>
                  <th className={thClass}>Mã</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {rows.map((row) => (
                  <tr key={row.row}>
                    <td className={tdClass}>{row.row}</td>
                    <td className={tdClass}>{row.orderReference}</td>
                    <td className={tdClass}>{row.customerName}</td>
                    <td className={tdClass}>
                      <Badge tone={row.ok ? "success" : "danger"}>{row.ok ? "OK" : "Lỗi"}</Badge>{" "}
                      <span className="text-xs text-navy/60">{row.message}</span>
                    </td>
                    <td className={`${tdClass} font-mono`}>{row.code ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
