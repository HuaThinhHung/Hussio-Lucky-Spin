import { requireAdmin } from "@/server/auth/session";
import { logoutAction } from "@/app/admin/_actions/auth";
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <div className="min-h-dvh bg-ivory text-navy [color-scheme:light]"><header className="flex justify-between border-b p-5"><a href="/admin">HUSSIO · Quản lý mã</a><form action={logoutAction}><button>Đăng xuất</button></form></header><main className="mx-auto max-w-6xl p-5">{children}</main></div>;
}
