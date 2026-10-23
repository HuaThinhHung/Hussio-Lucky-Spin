"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export type AdminNavItem = { href: string; label: string; adminOnly?: boolean };

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/codes", label: "Mã quay" },
  { href: "/admin/codes/new", label: "Tạo mã quay" },
  { href: "/admin/codes/import", label: "Import CSV" },
  { href: "/admin/winners", label: "Người trúng" },
  { href: "/admin/vouchers", label: "Voucher" },
  { href: "/admin/prizes", label: "Giải thưởng", adminOnly: true },
  { href: "/admin/inventory", label: "Kho quà tặng", adminOnly: true },
  { href: "/admin/campaign", label: "Chương trình", adminOnly: true },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/settings", label: "Cài đặt" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/codes") return pathname === "/admin/codes";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = ADMIN_NAV.filter((item) => isAdmin || !item.adminOnly);

  return (
    <nav aria-label="Quản trị">
      <ul className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-lg px-3 py-2 text-sm transition",
                  active ? "bg-gold/20 font-semibold text-gold-light" : "text-ivory/75 hover:bg-ivory/10 hover:text-ivory",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
