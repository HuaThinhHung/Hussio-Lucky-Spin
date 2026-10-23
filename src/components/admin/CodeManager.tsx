"use client";
import { useCallback, useEffect, useState } from "react";
type Row = { id: string; code: string; status: string; orderReference: string; usedAt: string | null; source: string; spin: { prize: { name: string } } | null };
const labels: Record<string, string> = { PENDING: "Chưa cấp", ACTIVE: "Đã cấp · Chưa quay", USED: "✓ Đã dùng", CANCELLED: "Đã khóa", EXPIRED: "Hết hạn" };
export default function CodeManager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState("");
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/manage/codes", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRows(data.codes); setUpdated(new Date().toLocaleTimeString("vi-VN")); setError("");
    } catch { setError("Không tải được trạng thái mới. Kiểm tra mạng hoặc đăng nhập lại."); }
  }, []);
  useEffect(() => { const initial = setTimeout(() => void refresh(), 0); const timer = setInterval(() => void refresh(), 3000); return () => { clearTimeout(initial); clearInterval(timer); }; }, [refresh]);
  async function act(body: object) {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/manage/codes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Chưa thực hiện được"); }
    finally { setBusy(false); }
  }
  return <div><h1 className="text-3xl font-semibold">Mã quay của cửa hàng</h1>
    <p className="mt-2 text-sm">Tạo mã → nhập mã đơn để cấp cho khách → khách quay → tự đánh dấu đã dùng.</p>
    <div className="my-6 flex flex-wrap gap-4"><button disabled={busy} onClick={() => act({ action: "batch" })} className="rounded-xl bg-navy px-5 py-3 text-ivory disabled:opacity-50">Tạo đủ 500 mã</button><input aria-label="Tìm mã hoặc đơn hàng" placeholder="Tìm mã / mã đơn hàng…" value={query} onChange={e => setQuery(e.target.value)} className="rounded-xl border p-3" /></div>
    <p className="mb-4 text-sm">{rows.length} mã · {rows.filter(r => r.status === "USED").length} đã dùng · Tự cập nhật mỗi 3 giây {updated && `· ${updated}`}</p>
    {error && <p role="alert" className="mb-4 text-red-700">{error}</p>}
    <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-navy text-ivory"><tr>{["Mã quay", "Mã đơn / cấp mã", "Trạng thái", "Quà trúng"].map(x => <th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>
    {rows.filter(r => `${r.code} ${r.orderReference}`.toLowerCase().includes(query.toLowerCase())).map(r => <tr key={r.id} className="border-b">
      <td className="p-3 font-mono"><button title="Sao chép mã" onClick={async () => { try { await navigator.clipboard.writeText(r.code); } catch { setError("Hãy bôi đen mã để sao chép."); } }}>{r.code}</button></td>
      <td className="p-3">{r.status === "PENDING" && r.source === "simple_batch" ? <form className="flex gap-2" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); void act({ action: "issue", id: r.id, order: data.get("order") }); }}><input name="order" required maxLength={64} placeholder="Mã đơn hàng" aria-label={`Đơn hàng cho ${r.code}`} className="w-32 rounded border p-2" /><button disabled={busy} className="rounded bg-gold px-3">Cấp mã</button></form> : r.orderReference}</td>
      <td className="p-3">{labels[r.status]}{r.usedAt && <small className="block">{new Date(r.usedAt).toLocaleString("vi-VN")}</small>}</td><td className="p-3">{r.spin?.prize.name ?? "—"}</td>
    </tr>)}</tbody></table></div></div>;
}
