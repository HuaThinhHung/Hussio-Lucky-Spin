import type { Metadata } from "next";
import { savePrizeAction } from "@/app/admin/_actions/catalog";
import ActionForm from "@/components/admin/ActionForm";
import SubmitButton from "@/components/admin/SubmitButton";
import { Card, EmptyState, inputClass, labelClass, PageHeader } from "@/components/admin/ui";
import type { GiftPool, Prize } from "@/generated/prisma/client";
import { GIFT_CATEGORY_LABELS, PRIZE_TYPE_LABELS } from "@/lib/constants";
import { formatPercent } from "@/lib/format";
import { requireAdmin } from "@/server/auth/session";
import { getPublicCampaign } from "@/server/campaign";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Giải thưởng" };

const PRIZE_TYPES = Object.keys(PRIZE_TYPE_LABELS) as (keyof typeof PRIZE_TYPE_LABELS)[];

export default async function PrizesPage() {
  await requireAdmin("ADMIN");
  const campaign = await getPublicCampaign();
  if (!campaign) return <EmptyState>Chưa có chương trình.</EmptyState>;

  const [prizes, pools] = await Promise.all([
    db.prize.findMany({ where: { campaignId: campaign.id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.giftPool.findMany({ where: { campaignId: campaign.id }, orderBy: { category: "asc" } }),
  ]);
  const totalWeight = prizes.filter((p) => p.active).reduce((sum, p) => sum + p.weight, 0);
  const physicalWeight = prizes.filter((p) => p.active && p.type === "PRODUCT_POOL").reduce((sum, p) => sum + p.weight, 0);

  return (
    <>
      <PageHeader
        title="Giải thưởng & tỷ lệ"
        description={`Tỷ lệ = trọng số / tổng trọng số giải còn quà (hiện tại tổng ${totalWeight}, quà sản phẩm ${formatPercent(
          totalWeight ? physicalWeight / totalWeight : 0,
        )}). Giải hết kho / hết quota tự động bị loại khỏi lượt quay. Thứ tự hiển thị = vị trí trên vòng quay.`}
      />

      <div className="space-y-3">
        {prizes.map((prize) => (
          <PrizeRow key={prize.id} prize={prize} pools={pools} campaignId={campaign.id} share={prize.active && totalWeight ? prize.weight / totalWeight : 0} />
        ))}
      </div>

      <Card title="Thêm giải mới" className="mt-8">
        <PrizeForm pools={pools} campaignId={campaign.id} />
      </Card>
    </>
  );
}

function PrizeRow({ prize, pools, campaignId, share }: { prize: Prize; pools: GiftPool[]; campaignId: string; share: number }) {
  const quota = prize.stockLimit === null ? "Không giới hạn" : `${prize.stockUsed}/${prize.stockLimit}`;
  return (
    <Card className={prize.active ? "" : "opacity-70"}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">
          #{prize.sortOrder} · {prize.name}
        </p>
        <p className="text-xs text-navy/60">
          Tỷ lệ hiện tại <strong className="text-navy">{formatPercent(share)}</strong> · Đã trúng {prize.stockUsed} · Quota {quota}
        </p>
      </div>
      <PrizeForm prize={prize} pools={pools} campaignId={campaignId} />
    </Card>
  );
}

function PrizeForm({ prize, pools, campaignId }: { prize?: Prize; pools: GiftPool[]; campaignId: string }) {
  const id = prize?.id ?? "new";
  return (
    <ActionForm action={savePrizeAction} resetOnSuccess={!prize} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <input type="hidden" name="id" value={prize?.id ?? ""} />
      <input type="hidden" name="campaignId" value={campaignId} />
      <div className="lg:col-span-2">
        <label htmlFor={`name-${id}`} className={labelClass}>Tên giải</label>
        <input id={`name-${id}`} name="name" defaultValue={prize?.name} required maxLength={80} className={inputClass} />
      </div>
      <div>
        <label htmlFor={`label-${id}`} className={labelClass}>Chữ lớn trên vòng</label>
        <input id={`label-${id}`} name="wheelLabel" defaultValue={prize?.wheelLabel} required maxLength={12} className={inputClass} />
      </div>
      <div>
        <label htmlFor={`caption-${id}`} className={labelClass}>Chữ nhỏ</label>
        <input id={`caption-${id}`} name="wheelCaption" defaultValue={prize?.wheelCaption ?? ""} maxLength={14} className={inputClass} />
      </div>
      <div>
        <label htmlFor={`type-${id}`} className={labelClass}>Loại</label>
        <select id={`type-${id}`} name="type" defaultValue={prize?.type ?? "VOUCHER"} className={inputClass}>
          {PRIZE_TYPES.map((type) => (
            <option key={type} value={type}>{PRIZE_TYPE_LABELS[type]}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`weight-${id}`} className={labelClass}>Trọng số</label>
        <input id={`weight-${id}`} name="weight" type="number" min={0} defaultValue={prize?.weight ?? 0} required className={inputClass} />
      </div>
      <div>
        <label htmlFor={`value-${id}`} className={labelClass}>Giá trị voucher (đ)</label>
        <input id={`value-${id}`} name="voucherValue" inputMode="numeric" defaultValue={prize?.voucherValue ?? ""} className={inputClass} />
      </div>
      <div>
        <label htmlFor={`min-${id}`} className={labelClass}>Đơn tối thiểu (đ)</label>
        <input id={`min-${id}`} name="voucherMinSpend" inputMode="numeric" defaultValue={prize?.voucherMinSpend ?? ""} className={inputClass} />
      </div>
      <div>
        <label htmlFor={`pool-${id}`} className={labelClass}>Kho quà (sản phẩm)</label>
        <select id={`pool-${id}`} name="giftPoolId" defaultValue={prize?.giftPoolId ?? ""} className={inputClass}>
          <option value="">—</option>
          {pools.map((pool) => (
            <option key={pool.id} value={pool.id}>
              {GIFT_CATEGORY_LABELS[pool.category]} ({pool.quantityRemaining})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`limit-${id}`} className={labelClass}>Quota (trống = ∞)</label>
        <input id={`limit-${id}`} name="stockLimit" inputMode="numeric" defaultValue={prize?.stockLimit ?? ""} className={inputClass} />
      </div>
      <div>
        <label htmlFor={`sort-${id}`} className={labelClass}>Thứ tự</label>
        <input id={`sort-${id}`} name="sortOrder" type="number" min={0} defaultValue={prize?.sortOrder ?? 10} className={inputClass} />
      </div>
      <div className="flex items-end gap-3">
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={prize?.active ?? true} className="size-4 accent-[#142238]" />
          Hiển thị
        </label>
        <SubmitButton pendingLabel="Đang lưu…">{prize ? "Lưu" : "Thêm"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
