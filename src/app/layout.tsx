import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Playfair_Display } from "next/font/google";
import { BRAND } from "@/lib/constants";
import "./globals.css";
import "./portfolio.css";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const siteUrl = process.env.APP_URL ?? BRAND.siteUrl;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${BRAND.programName} — ${BRAND.campaignBadge}`,
    template: `%s · ${BRAND.programName}`,
  },
  description:
    "Mỗi đơn hàng HUSSIO từ 1.300.000đ nhận một mã Lucky Spin. Nhập mã và quay để nhận quà từ HUSSIO — 100% có quà.",
  openGraph: {
    title: `${BRAND.programName} — Quay là có quà`,
    description: "Mua từ 1.300.000đ, nhận 01 mã quay, 100% có quà. Black Friday 2026.",
    url: siteUrl,
    siteName: BRAND.programName,
    locale: "vi_VN",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A1628",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${beVietnam.variable} ${playfair.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
