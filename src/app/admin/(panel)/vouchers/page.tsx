import type { Metadata } from "next";
import { syncVoucherAction } from "@/app/admin/_actions/rewards";
import ActionForm from "@/components/admin/ActionForm";
import SubmitButton from "@/components/admin/SubmitButton";
import { Badge, EmptyState, PageHeader, Pagination, tableClass, tdClass, thClass, type BadgeTone } from "@/components/admin/ui";
import type { VoucherStatus, VoucherSyncStatus } from "@/generated/prisma/enums";
import { formatDate, formatVnd } from "@/lib/format";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/server/db";
import { isShopifyConfigured } from "@/server/shopify/client";

export const metadata: Metadata = { title: "Voucher" };

const PAGE_SIZE = 50;
const STATUS_TONES: Record<VoucherStatus, BadgeTone> = { ISSUED: "gold", REDEEMED: "success", EXPIRED: "neutral", VOID: "danger" };
const SYNC_TONES: Record<VoucherSyncStatus, BadgeTone> = { PENDING: "warning", SYNCED: "success", FAILED: "danger", SKIPPED: "neutral" };
const SYNC_LABELS: Record<VoucherSyncStatus, string> = {
  PENDING: "Đang tạo trên Shopify",
  SYNCED: "Đã có trên Shopify",
  FAILED: "Lỗi đồng bộ",
  SKIPPED: "MOCK (chưa kết nối)",
};

export default async function VouchersPage({ searchParams }: PageProps<"/admin/vouchers">) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const shopifyReady = isShopifyConfigured();

  const [total, vouchers, summary] = await Promise.all([
    db.voucher.count(),
    db.voucher.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { spin: { select: { luckyCode: { select: { customerName: true, orderReference: true } } } } },
    }),
    db.voucher.groupBy({ by: ["status"], _count: true, _sum: { value: true } }),
  ]);

  const summaryText = summary.map((row) => `${row.status}: ${row._count}`).join(" · ");

  return (
    <>
      <PageHeader
        title="Voucher"
        description={`Voucher cho đơn tiếp theo, mã dùng 1 lần, có hạn. ${summaryText || "Chưa có voucher."} Thời hạn, điều kiện cộng dồn: trang Chương trình. Giá trị & đơn tối thiểu: trang Giải thưởng.`}
      />

      {vouchers.length === 0 ? (
        <EmptyState>Chưa có voucher nào được phát.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-navy/10 bg-white">
          <table className={tableClass}>
            <thead className="bg-navy/[0.03]">
              <tr>
                <th className={thClass}>Mã voucher</th>
                <th className={thClass}>Loại / Giá trị</th>
                <th className={thClass}>Đơn tối thiểu</th>
                <th className={thClass}>Khách</th>
                <th className={thClass}>Hạn dùng</th>
                <th className={thClass}>Trạng thái</th>
                <th className={thClass}>Shopify</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {vouchers.map((voucher) => (
                <tr key={voucher.id}>
                  <td className={`${tdClass} font-mono font-semibold`}>{voucher.code}</td>
                  <td className={tdClass}>{voucher.type === "FREE_SHIPPING" ? "Freeship" : formatVnd(voucher.value)}</td>
                  <td className={tdClass}>{voucher.minimumSpend ? formatVnd(voucher.minimumSpend) : "—"}</td>
                  <td className={tdClass}>
                    {voucher.spin.luckyCode.customerName}
                    <p className="text-xs text-navy/50">{voucher.spin.luckyCode.orderReference}</p>
                  </td>
                  <td className={tdClass}>{formatDate(voucher.expiresAt)}</td>
                  <td className={tdClass}>
                    <Badge tone={STATUS_TONES[voucher.status]}>{voucher.status}</Badge>
                    {voucher.redeemedOrderRef ? <p className="mt-1 text-xs text-navy/50">Đơn {voucher.redeemedOrderRef}</p> : null}
                  </td>
                  <td className={tdClass}>
                    <Badge tone={SYNC_TONES[voucher.syncStatus]}>{SYNC_LABELS[voucher.syncStatus]}</Badge>
                    {voucher.syncError ? <p className="mt-1 max-w-56 whitespace-normal text-xs text-red-700">{voucher.syncError}</p> : null}
                    {admin.role === "ADMIN" && shopifyReady && voucher.status === "ISSUED" && voucher.syncStatus !== "SYNCED" ? (
                      <ActionForm action={syncVoucherAction} className="mt-1.5">
                        <input type="hidden" name="voucherId" value={voucher.id} />
                        <SubmitButton size="sm" variant="secondary">
                          Đồng bộ Shopify
                        </SubmitButton>
                      </ActionForm>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} buildHref={(p) => `/admin/vouchers?page=${p}`} />
    </>
  );
}
