import Link from "next/link";
import { approveCodeAction, cancelCodeAction, unlockCodeAction } from "@/app/admin/_actions/codes";
import ActionForm from "@/components/admin/ActionForm";
import CopyButton from "@/components/admin/CopyButton";
import SubmitButton from "@/components/admin/SubmitButton";
import {
  Badge,
  EmptyState,
  inputClass,
  PageHeader,
  Pagination,
  tableClass,
  tdClass,
  thClass,
  type BadgeTone,
} from "@/components/admin/ui";
import type { Prisma } from "@/generated/prisma/client";
import type { Channel, LuckyCodeStatus } from "@/generated/prisma/enums";
import { buildCustomerMessage, CHANNEL_LABELS, CODE_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime, formatVnd } from "@/lib/format";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/server/db";

const PAGE_SIZE = 50;
const STATUS_TONES: Record<LuckyCodeStatus, BadgeTone> = {
  PENDING: "warning",
  ACTIVE: "info",
  USED: "success",
  CANCELLED: "danger",
  EXPIRED: "neutral",
};
const STATUSES = Object.keys(CODE_STATUS_LABELS) as LuckyCodeStatus[];
const CHANNELS = Object.keys(CHANNEL_LABELS) as Channel[];

export default async function CodesPage({ searchParams }: PageProps<"/admin/codes">) {
  await requireAdmin();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 60) : "";
  const status = STATUSES.find((s) => s === params.status);
  const channel = CHANNELS.find((c) => c === params.channel);
  const page = Math.max(1, Number(params.page) || 1);

  const where: Prisma.LuckyCodeWhereInput = {
    ...(status ? { status } : {}),
    ...(channel ? { channel } : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q.toUpperCase() } },
            { orderReference: { contains: q, mode: "insensitive" } },
            { customerName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, codes] = await Promise.all([
    db.luckyCode.count({ where }),
    db.luckyCode.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { spin: { select: { prize: { select: { name: true } } } } },
    }),
  ]);

  const query = new URLSearchParams({
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
    ...(channel ? { channel } : {}),
  });
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Mã quay"
        description={`${total.toLocaleString("vi-VN")} mã. Số điện thoại chỉ lưu dạng hash — cột SĐT hiển thị 3 số cuối để đối chiếu.`}
        actions={
          <>
            <a href={`/admin/codes/export?${query.toString()}`} className="inline-flex h-10 items-center rounded-lg border border-navy/20 bg-white px-4 text-sm font-semibold hover:border-navy">
              Xuất CSV
            </a>
            <Link href="/admin/codes/new" className="inline-flex h-10 items-center rounded-lg bg-navy px-4 text-sm font-semibold text-ivory hover:bg-navy-soft">
              + Tạo mã
            </Link>
          </>
        }
      />

      <form className="mb-4 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]" role="search">
        <input name="q" defaultValue={q} placeholder="Tìm mã, mã đơn, tên khách…" aria-label="Tìm kiếm" className={inputClass} />
        <select name="status" defaultValue={status ?? ""} aria-label="Trạng thái" className={inputClass}>
          <option value="">Tất cả trạng thái</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {CODE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select name="channel" defaultValue={channel ?? ""} aria-label="Kênh" className={inputClass}>
          <option value="">Tất cả kênh</option>
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {CHANNEL_LABELS[c]}
            </option>
          ))}
        </select>
        <button type="submit" className="h-10 rounded-lg bg-navy px-4 text-sm font-semibold text-ivory">
          Lọc
        </button>
      </form>

      {codes.length === 0 ? (
        <EmptyState>Chưa có mã nào phù hợp.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-navy/10 bg-white">
          <table className={tableClass}>
            <thead className="bg-navy/[0.03]">
              <tr>
                <th className={thClass}>Mã</th>
                <th className={thClass}>Khách hàng</th>
                <th className={thClass}>Kênh / Đơn</th>
                <th className={thClass}>Giá trị</th>
                <th className={thClass}>Trạng thái</th>
                <th className={thClass}>Phát / Hết hạn</th>
                <th className={thClass}>Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {codes.map((code) => {
                const locked = code.lockedUntil && code.lockedUntil > now;
                return (
                  <tr key={code.id}>
                    <td className={tdClass}>
                      <span className="font-mono font-semibold">{code.code}</span>
                      {code.spin ? <p className="mt-0.5 text-xs text-navy/55">🎁 {code.spin.prize.name}</p> : null}
                    </td>
                    <td className={tdClass}>
                      {code.customerName}
                      <p className="text-xs text-navy/50">
                        SĐT ***{code.phoneHint ?? "?"}
                        {code.customerCity ? ` · ${code.customerCity}` : ""}
                      </p>
                    </td>
                    <td className={tdClass}>
                      {CHANNEL_LABELS[code.channel]}
                      <p className="text-xs text-navy/50">{code.orderReference}</p>
                    </td>
                    <td className={tdClass}>{formatVnd(code.orderValue)}</td>
                    <td className={tdClass}>
                      <Badge tone={STATUS_TONES[code.status]}>{CODE_STATUS_LABELS[code.status]}</Badge>
                      {locked ? (
                        <p className="mt-1">
                          <Badge tone="danger">Tạm khoá</Badge>
                        </p>
                      ) : null}
                    </td>
                    <td className={tdClass}>
                      {formatDateTime(code.issuedAt)}
                      <p className="text-xs text-navy/50">{code.expiresAt ? `HSD ${formatDate(code.expiresAt)}` : "Không hạn"}</p>
                    </td>
                    <td className={tdClass}>
                      <div className="flex flex-wrap gap-1.5">
                        <CopyButton text={code.code} label="Copy mã" />
                        {code.status === "ACTIVE" ? <CopyButton text={buildCustomerMessage(code.code)} label="Copy tin nhắn" /> : null}
                        {code.status === "PENDING" ? (
                          <ActionForm action={approveCodeAction} quietSuccess>
                            <input type="hidden" name="id" value={code.id} />
                            <SubmitButton size="sm">Duyệt</SubmitButton>
                          </ActionForm>
                        ) : null}
                        {locked ? (
                          <ActionForm action={unlockCodeAction} quietSuccess>
                            <input type="hidden" name="id" value={code.id} />
                            <SubmitButton size="sm" variant="secondary">
                              Mở khoá
                            </SubmitButton>
                          </ActionForm>
                        ) : null}
                        {code.status === "ACTIVE" || code.status === "PENDING" || code.status === "EXPIRED" ? (
                          <ActionForm action={cancelCodeAction} confirmMessage={`Huỷ mã ${code.code}?`} quietSuccess>
                            <input type="hidden" name="id" value={code.id} />
                            <input type="hidden" name="reason" value="Huỷ bởi admin" />
                            <SubmitButton size="sm" variant="danger">
                              Huỷ
                            </SubmitButton>
                          </ActionForm>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={Math.ceil(total / PAGE_SIZE)}
        buildHref={(p) => `/admin/codes?${new URLSearchParams({ ...Object.fromEntries(query), page: String(p) }).toString()}`}
      />
    </>
  );
}
