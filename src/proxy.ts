import { NextResponse } from "next/server";
// Legacy routes are retired; production is the Google-hosted web app.
export function proxy() {
  return NextResponse.json({ ok: false, message: "Quản lý trong Google Sheet. Bản này chỉ xem trước giao diện." }, { status: 410 });
}
export const config = { matcher: ["/admin", "/admin/:path*", "/api/:path*"] };
