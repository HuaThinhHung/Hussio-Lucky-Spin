import type { Metadata } from "next";
import { markWinnerAction, voidRewardAction } from "@/app/admin/_actions/rewards";
import ActionForm from "@/components/admin/ActionForm";
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
import type { WinnerStatus } from "@/generated/prisma/enums";
import { CHANNEL_LABELS, WINNER_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Người trúng" };

const PAGE_SIZE = 50;
const STATUS_TONES: Record<WinnerStatus, BadgeTone> = { WON: "gold", CONFIRMED: "info", FULFILLED: "success", VOID: "danger" };
const STATUSES = Object.keys(WINNER_STATUS_LABELS) as WinnerStatus[];

export default async function WinnersPage({ searchParams }: PageProps<"/admin/winners">) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const status = STATUSES.find((s) => s === params.status);
  const kind = params.kind === "physical" || params.kind === "voucher" ? params.kind : undefined;
  const page = Math.max(1, Number(params.page) || 1);

  const where: Prisma.WinnerWhereInput = {
    ...(status ? { status } : {}),
    ...(kind === "physical" ? { prize: { type: "PRODUCT_POOL" } } : {}),
    ...(kind === "voucher" ? { prize: { type: { in: ["VOUCHER", "FREE_SHIPPING"] } } } : {}),
  };

  const [total, winners] = await Promise.all([
    db.winner.count({ where }),
    db.winner.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        prize: { select: { name: true, type: true } },
        spin: {
          select: {
            id: true,
            giftItem: { select: { productName: true, size: true, color: true, sku: true } },
            voucher: { select: { code: true, status: true } },
            luckyCode: { select: { customerName: true, phoneHint: true, channel: true, orderReference: true, code: true } },
          },
        },
      },
    }),
  ]);

  const query = new URLSearchParams({ ...(status ? { status } : {}), ...(kind ? { kind } : {}) });

  return (
    <>
      <PageHeader
        title="Người trúng thưởng"
        description="Theo dõi trao quà: WON → CONFIRMED (đã liên hệ, chốt size) → FULFILLED (đã giao). VOID khi đơn huỷ / hoàn."
      />

      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <select name="status" defaultValue={status ?? ""} aria-label="Trạng thái" className={inputClass}>
          <option value="">Tất cả trạng thái</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s} — {WINNER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select name="kind" defaultValue={kind ?? ""} aria-label="Loại quà" className={inputClass}>
          <option value="">Tất cả loại quà</option>
          <option value="physical">Quà sản phẩm</option>
          <option value="voucher">Voucher / Freeship</option>
        </select>
        <button type="submit" className="h-10 rounded-lg bg-navy px-4 text-sm font-semibold text-ivory">
          Lọc
        </button>
      </form>

      {winners.length === 0 ? (
        <EmptyState>Chưa có người trúng.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-navy/10 bg-white">
          <table className={tableClass}>
            <thead className="bg-navy/[0.03]">
              <tr>
                <th className={thClass}>Thời gian</th>
                <th className={thClass}>Khách hàng</th>
                <th className={thClass}>Kênh / Đơn</th>
                <th className={thClass}>Giải</th>
                <th className={thClass}>Quà cụ thể</th>
                <th className={thClass}>Size</th>
                <th className={thClass}>Trạng thái</th>
                <th className={thClass}>Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {winners.map((winner) => {
                const lucky = winner.spin.luckyCode;
                const item = winner.spin.giftItem;
                return (
                  <tr key={winner.id}>
                    <td className={tdClass}>{formatDateTime(winner.createdAt)}</td>
                    <td className={tdClass}>
                      {lucky.customerName}
                      <p className="text-xs text-navy/50">
                        SĐT ***{lucky.phoneHint ?? "?"} {winner.city ? `· ${winner.city}` : ""}
                      </p>
                    </td>
                    <td className={tdClass}>
                      {CHANNEL_LABELS[lucky.channel]}
                      <p className="text-xs text-navy/50">{lucky.orderReference}</p>
                      <p className="font-mono text-[11px] text-navy/40">{lucky.code}</p>
                    </td>
                    <td className={tdClass}>
                      {winner.prize.name}
                      {winner.spin.voucher ? (
                        <p className="font-mono text-xs text-navy/60">
                          {winner.spin.voucher.code} · {winner.spin.voucher.status}
                        </p>
                      ) : null}
                    </td>
                    <td className={tdClass}>
                      {item ? (
                        <>
                          {item.productName}
                          <p className="text-xs text-navy/50">
                            {[item.sku, item.color, item.size].filter(Boolean).join(" · ") || "—"}
                          </p>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={tdClass}>
                      {winner.sizePreference ?? "—"}
                      {winner.customerNote ? <p className="max-w-48 whitespace-normal text-xs text-navy/55">“{winner.customerNote}”</p> : null}
                    </td>
                    <td className={tdClass}>
                      <Badge tone={STATUS_TONES[winner.status]}>{winner.status}</Badge>
                      {winner.voidReason ? <p className="mt-1 max-w-40 whitespace-normal text-xs text-navy/50">{winner.voidReason}</p> : null}
                    </td>
                    <td className={tdClass}>
                      <div className="flex flex-wrap gap-1.5">
                        {winner.status === "WON" ? (
                          <ActionForm action={markWinnerAction} quietSuccess>
                            <input type="hidden" name="spinId" value={winner.spinId} />
                            <input type="hidden" name="status" value="CONFIRMED" />
                            <SubmitButton size="sm" variant="secondary">
                              MARK CONFIRMED
                            </SubmitButton>
                          </ActionForm>
                        ) : null}
                        {winner.status === "WON" || winner.status === "CONFIRMED" ? (
                          <ActionForm action={markWinnerAction} quietSuccess>
                            <input type="hidden" name="spinId" value={winner.spinId} />
                            <input type="hidden" name="status" value="FULFILLED" />
                            <SubmitButton size="sm">MARK FULFILLED</SubmitButton>
                          </ActionForm>
                        ) : null}
                        {admin.role === "ADMIN" && winner.status !== "VOID" && winner.status !== "FULFILLED" ? (
                          <ActionForm action={voidRewardAction} confirmMessage="Huỷ phần thưởng này? Quà sẽ được trả về kho." quietSuccess>
                            <input type="hidden" name="spinId" value={winner.spinId} />
                            <input type="hidden" name="reason" value="Huỷ bởi admin" />
                            <SubmitButton size="sm" variant="danger">
                              VOID REWARD
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
        buildHref={(p) => `/admin/winners?${new URLSearchParams({ ...Object.fromEntries(query), page: String(p) }).toString()}`}
      />
    </>
  );
}
