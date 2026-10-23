import type { Metadata } from "next";
import ImportCodesForm from "@/app/admin/(panel)/codes/import/ImportCodesForm";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: "Import CSV" };

export default async function ImportCodesPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        title="BULK IMPORT CSV"
        description="Tạo mã hàng loạt cho đơn Facebook / Cửa hàng. Dòng hợp lệ được tạo mã; dòng lỗi (dưới ngưỡng, trùng đơn, SĐT sai) được báo lại."
      />
      <ImportCodesForm />
    </>
  );
}
