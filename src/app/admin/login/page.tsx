import type { Metadata } from "next";
import { redirect } from "next/navigation";
import HussioLogo from "@/components/brand/HussioLogo";
import LoginForm from "@/app/admin/login/LoginForm";
import { getAdminSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Đăng nhập quản trị", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect("/admin");

  return (
    <main className="bg-hussio-gradient flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-3xl border border-gold/30 bg-navy/80 p-8 shadow-2xl">
        <div className="text-center">
          <HussioLogo />
          <p className="mt-2 text-[11px] font-semibold tracking-[0.3em] text-gold">LUCKY SPIN ADMIN</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
