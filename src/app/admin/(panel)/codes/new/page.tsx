import type { Metadata } from "next";
import CreateCodeForm from "@/app/admin/(panel)/codes/new/CreateCodeForm";
import { PageHeader } from "@/components/admin/ui";
import { formatVnd } from "@/lib/format";
import { requireAdmin } from "@/server/auth/session";
import { getIssuingCampaign } from "@/server/campaign";

export const metadata: Metadata = { title: "Tạo mã quay" };

export default async function NewCodePage() {
  await requireAdmin();
  const campaign = await getIssuingCampaign();

  return (
    <>
      <PageHeader
        title="TẠO LƯỢT QUAY"
        description={
          campaign
            ? `Dành cho đơn Facebook / Cửa hàng (hoặc đơn Website cần cấp tay). Đơn từ ${formatVnd(campaign.minimumOrderValue)} — mỗi đơn 01 mã.`
            : "Chưa có chương trình đang mở để phát mã."
        }
      />
      {campaign ? <CreateCodeForm minimumOrderValue={campaign.minimumOrderValue} /> : null}
    </>
  );
}
