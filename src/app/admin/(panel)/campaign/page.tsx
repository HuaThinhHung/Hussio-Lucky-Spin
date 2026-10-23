import type { Metadata } from "next";
import { updateCampaignAction } from "@/app/admin/_actions/catalog";
import ActionForm from "@/components/admin/ActionForm";
import SubmitButton from "@/components/admin/SubmitButton";
import { Card, EmptyState, Field, inputClass, PageHeader } from "@/components/admin/ui";
import { toDateTimeLocalValue } from "@/lib/format";
import { requireAdmin } from "@/server/auth/session";
import { getPublicCampaign } from "@/server/campaign";

export const metadata: Metadata = { title: "Chương trình" };

export default async function CampaignPage() {
  await requireAdmin("ADMIN");
  const campaign = await getPublicCampaign();
  if (!campaign) return <EmptyState>Chưa có chương trình. Chạy `npm run db:seed`.</EmptyState>;

  return (
    <>
      <PageHeader title="Chương trình" description="Thời gian, ngưỡng đơn, COD, quyền riêng tư người trúng, voucher và thể lệ." />
      <ActionForm action={updateCampaignAction} className="space-y-6">
        <input type="hidden" name="id" value={campaign.id} />

        <Card title="Thông tin chung">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tên chương trình" htmlFor="name">
              <input id="name" name="name" defaultValue={campaign.name} required className={inputClass} />
            </Field>
            <Field label="Trạng thái" htmlFor="status" hint="ACTIVE = khách quay được (trong khung thời gian). Chỉ 1 chương trình ACTIVE.">
              <select id="status" name="status" defaultValue={campaign.status} className={inputClass}>
                <option value="DRAFT">DRAFT — chuẩn bị</option>
                <option value="ACTIVE">ACTIVE — đang chạy</option>
                <option value="PAUSED">PAUSED — tạm dừng</option>
                <option value="ENDED">ENDED — kết thúc</option>
              </select>
            </Field>
            <Field label="Bắt đầu quay (giờ VN)" htmlFor="startsAt">
              <input id="startsAt" name="startsAt" type="datetime-local" defaultValue={toDateTimeLocalValue(campaign.startsAt)} className={inputClass} />
            </Field>
            <Field label="Kết thúc quay (giờ VN)" htmlFor="endsAt">
              <input id="endsAt" name="endsAt" type="datetime-local" defaultValue={toDateTimeLocalValue(campaign.endsAt)} className={inputClass} />
            </Field>
            <Field label="Hạn chót đặt đơn đủ điều kiện (Website)" htmlFor="ordersEndAt" hint="Đơn Shopify tạo sau mốc này không được cấp mã tự động. Để trống = theo ngày kết thúc.">
              <input id="ordersEndAt" name="ordersEndAt" type="datetime-local" defaultValue={toDateTimeLocalValue(campaign.ordersEndAt)} className={inputClass} />
            </Field>
            <Field label="Giá trị đơn tối thiểu (đ)" htmlFor="minimumOrderValue" hint="Tính trên tiền hàng sau giảm giá, không gồm phí ship.">
              <input id="minimumOrderValue" name="minimumOrderValue" inputMode="numeric" defaultValue={campaign.minimumOrderValue} required className={inputClass} />
            </Field>
          </div>
        </Card>

        <Card title="Mã quay">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Tiền tố mã" htmlFor="codePrefix" hint="Dạng CHỮ-XXXX, ví dụ HUSSIO-BF26">
              <input id="codePrefix" name="codePrefix" defaultValue={campaign.codePrefix} required className={inputClass} />
            </Field>
            <Field label="Hiệu lực mã (ngày)" htmlFor="codeValidityDays">
              <input id="codeValidityDays" name="codeValidityDays" type="number" min={1} max={365} defaultValue={campaign.codeValidityDays} className={inputClass} />
            </Field>
            <Field label="Đơn COD (Website) được cấp mã khi" htmlFor="codEligibilityMode">
              <select id="codEligibilityMode" name="codEligibilityMode" defaultValue={campaign.codEligibilityMode} className={inputClass}>
                <option value="CONFIRMED_ORDER">CONFIRMED_ORDER — đơn đã xác nhận</option>
                <option value="PAID">PAID — đã thu tiền COD</option>
                <option value="MANUAL_APPROVAL">MANUAL_APPROVAL — admin duyệt</option>
              </select>
            </Field>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-navy/50">
            <input type="checkbox" disabled checked={campaign.multiSpinEnabled} readOnly className="size-4" />
            Nhiều lượt theo giá trị đơn (2.600.000đ = 2 lượt) — sẽ mở sau MVP
          </label>
        </Card>

        <Card title="Voucher (cho đơn hàng tiếp theo)">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Thời hạn voucher (ngày)" htmlFor="voucherValidityDays">
              <input id="voucherValidityDays" name="voucherValidityDays" type="number" min={1} max={365} defaultValue={campaign.voucherValidityDays} className={inputClass} />
            </Field>
            <fieldset>
              <legend className="mb-1 text-xs font-semibold text-navy/75">Cho phép cộng dồn với</legend>
              <div className="space-y-1.5 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="combineOrder" defaultChecked={campaign.voucherCombinesWithOrderDiscounts} className="size-4 accent-[#142238]" />
                  Giảm giá đơn hàng khác
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="combineProduct" defaultChecked={campaign.voucherCombinesWithProductDiscounts} className="size-4 accent-[#142238]" />
                  Giảm giá sản phẩm
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="combineShipping" defaultChecked={campaign.voucherCombinesWithShippingDiscounts} className="size-4 accent-[#142238]" />
                  Giảm phí vận chuyển
                </label>
              </div>
            </fieldset>
          </div>
        </Card>

        <Card title="Người may mắn & thể lệ">
          <div className="grid gap-4">
            <Field label="Hiển thị tên người trúng" htmlFor="winnerNameMode">
              <select id="winnerNameMode" name="winnerNameMode" defaultValue={campaign.winnerNameMode} className={inputClass}>
                <option value="MASKED">MASKED — Hứa H***</option>
                <option value="FIRST_NAME">FIRST_NAME — chỉ tên (Hưng)</option>
                <option value="FULL_NAME_WITH_CONSENT">FULL_NAME_WITH_CONSENT — tên đầy đủ nếu khách đồng ý</option>
              </select>
            </Field>
            <Field label="Thể lệ chương trình (mỗi dòng một điều)" htmlFor="termsContent">
              <textarea id="termsContent" name="termsContent" rows={10} defaultValue={campaign.termsContent} className={`${inputClass} h-auto py-2 leading-relaxed`} />
            </Field>
          </div>
        </Card>

        <SubmitButton pendingLabel="Đang lưu…">Lưu chương trình</SubmitButton>
      </ActionForm>
    </>
  );
}
