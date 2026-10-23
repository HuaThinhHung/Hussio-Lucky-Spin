import type { Metadata } from "next";
import Link from "next/link";
import { importGiftItemsAction, saveGiftItemAction } from "@/app/admin/_actions/catalog";
import ActionForm from "@/components/admin/ActionForm";
import SubmitButton from "@/components/admin/SubmitButton";
import { Card, EmptyState, Field, inputClass, PageHeader, StatCard } from "@/components/admin/ui";
import type { GiftItem, GiftPool } from "@/generated/prisma/client";
import { GIFT_CATEGORY_LABELS } from "@/lib/constants";
import { formatVnd } from "@/lib/format";
import { requireAdmin } from "@/server/auth/session";
import { getPublicCampaign } from "@/server/campaign";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Kho quà tặng" };

export default async function InventoryPage() {
  await requireAdmin("ADMIN");
  const campaign = await getPublicCampaign();
  if (!campaign) return <EmptyState>Chưa có chương trình.</EmptyState>;

  const pools = await db.giftPool.findMany({
    where: { campaignId: campaign.id },
    orderBy: { category: "asc" },
    include: { items: { orderBy: [{ active: "desc" }, { productName: "asc" }, { size: "asc" }] } },
  });
  const pendingFulfilment = await db.winner.count({
    where: { campaignId: campaign.id, status: { in: ["WON", "CONFIRMED"] }, prize: { type: "PRODUCT_POOL" } },
  });

  const totals = pools.reduce(
    (acc, pool) => {
      for (const item of pool.items) {
        if (!item.active) continue;
        acc.units += item.quantity;
        acc.cost += item.quantity * item.cost;
      }
      acc.allocated += pool.quantityTotal - pool.quantityRemaining;
      return acc;
    },
    { units: 0, cost: 0, allocated: 0 },
  );

  return (
    <>
      <PageHeader
        title="Kho quà tặng"
        description="Vòng quay chỉ hiển thị nhóm quà (Polo, Áo thun…). Khi khách trúng, hệ thống chọn 1 sản phẩm còn hàng trong nhóm và trừ kho ngay. Thêm size cho từng dòng để khách chỉ chọn được size còn hàng."
        actions={
          <Link href="/admin/winners?kind=physical&status=CONFIRMED" className="inline-flex h-10 items-center rounded-lg border border-navy/20 bg-white px-4 text-sm font-semibold hover:border-navy">
            Hàng đợi giao quà ({pendingFulfilment})
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Quà còn trong kho" value={totals.units.toLocaleString("vi-VN")} />
        <StatCard label="Giá vốn còn lại" value={formatVnd(totals.cost)} />
        <StatCard label="Đã trúng (đã trừ kho)" value={totals.allocated.toLocaleString("vi-VN")} />
        <StatCard label="Chờ giao" value={pendingFulfilment.toLocaleString("vi-VN")} hint="Đánh dấu FULFILLED ở trang Người trúng" />
      </div>

      <div className="space-y-6">
        {pools.map((pool) => (
          <PoolCard key={pool.id} pool={pool} />
        ))}
      </div>

      <Card title="Import danh sách quà (CSV)" className="mt-8">
        <ActionForm action={importGiftItemsAction} className="space-y-3">
          <input type="hidden" name="campaignId" value={campaign.id} />
          <p className="text-xs text-navy/60">
            Cột: <code>category,product_name,size,color,sku,quantity,cost</code> — category là POLO, TSHIRT, SHIRT, JACKET, PANTS hoặc OTHER.
            Dùng để nhập chính xác từng SKU/size từ Gift Sheet. Các dòng được <strong>thêm mới</strong>; hãy tắt dòng tổng cũ nếu thay thế.
          </p>
          <input name="file" type="file" accept=".csv,text/csv" aria-label="File CSV quà tặng" className="block text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-navy file:px-3 file:py-2 file:text-ivory" />
          <SubmitButton pendingLabel="Đang import…">Import</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}

function PoolCard({ pool }: { pool: GiftPool & { items: GiftItem[] } }) {
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {GIFT_CATEGORY_LABELS[pool.category]} <span className="text-sm font-normal text-navy/50">({pool.category})</span>
        </h2>
        <p className="text-sm text-navy/70">
          Còn <strong className="text-navy">{pool.quantityRemaining}</strong> / tổng {pool.quantityTotal}
        </p>
      </div>
      <div className="space-y-3">
        {pool.items.map((item) => (
          <GiftItemForm key={item.id} item={item} poolId={pool.id} />
        ))}
        <details className="rounded-xl border border-dashed border-navy/20 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-navy/80">+ Thêm sản phẩm quà vào nhóm này</summary>
          <div className="mt-3">
            <GiftItemForm poolId={pool.id} />
          </div>
        </details>
      </div>
    </Card>
  );
}

function GiftItemForm({ item, poolId }: { item?: GiftItem; poolId: string }) {
  const id = item?.id ?? `new-${poolId}`;
  return (
    <ActionForm
      action={saveGiftItemAction}
      resetOnSuccess={!item}
      className="grid items-end gap-2 sm:grid-cols-3 lg:grid-cols-[2fr_repeat(5,1fr)_auto]"
    >
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <input type="hidden" name="giftPoolId" value={poolId} />
      <Field label="Sản phẩm" htmlFor={`pn-${id}`}>
        <input id={`pn-${id}`} name="productName" defaultValue={item?.productName} required className={inputClass} />
      </Field>
      <Field label="Size" htmlFor={`sz-${id}`}>
        <input id={`sz-${id}`} name="size" defaultValue={item?.size ?? ""} placeholder="M/L/XL…" className={inputClass} />
      </Field>
      <Field label="Màu" htmlFor={`cl-${id}`}>
        <input id={`cl-${id}`} name="color" defaultValue={item?.color ?? ""} className={inputClass} />
      </Field>
      <Field label="SKU" htmlFor={`sku-${id}`}>
        <input id={`sku-${id}`} name="sku" defaultValue={item?.sku ?? ""} className={inputClass} />
      </Field>
      <Field label="Số lượng" htmlFor={`qty-${id}`}>
        <input id={`qty-${id}`} name="quantity" type="number" min={0} defaultValue={item?.quantity ?? 0} required className={inputClass} />
      </Field>
      <Field label="Giá vốn/sp (đ)" htmlFor={`cost-${id}`}>
        <input id={`cost-${id}`} name="cost" inputMode="numeric" defaultValue={item?.cost ?? 0} className={inputClass} />
      </Field>
      <div className="flex items-center gap-2">
        <label className="flex h-10 items-center gap-1.5 text-xs">
          <input type="checkbox" name="active" defaultChecked={item?.active ?? true} className="size-4 accent-[#142238]" />
          Bật
        </label>
        <SubmitButton size="md" pendingLabel="…">
          {item ? "Lưu" : "Thêm"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
