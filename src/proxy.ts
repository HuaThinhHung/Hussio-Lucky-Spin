import { NextResponse } from "next/server";
// Legacy database routes are retired. The standalone site calls Apps Script.
export function proxy() {
  return NextResponse.json({ ok: false, message: "Đường dẫn cũ đã ngừng hoạt động. Quản lý chương trình trong Google Sheet." }, { status: 410 });
}
export const config = { matcher: ["/admin", "/admin/:path*", "/api/:path*"] };
