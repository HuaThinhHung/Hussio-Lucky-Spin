# Triển khai production — quay.hussio-vn.com

> ⚠️ Chỉ làm các bước dưới đây khi HUSSIO đã duyệt go-live. Không bước nào ở đây được chạy tự động.

Kiến trúc: **Vercel** (Next.js 16) + **PostgreSQL** managed (Neon / Vercel Postgres / Supabase) + Shopify Admin GraphQL API.

---

## 1. Chuẩn bị database PostgreSQL

1. Tạo database PostgreSQL 15+ ở region gần Việt Nam (Singapore `ap-southeast-1`).
2. Lấy **pooled connection string** (PgBouncer / pooler) — serverless mở nhiều kết nối:
   ```
   postgresql://USER:PASSWORD@HOST/DB?sslmode=require
   ```
3. Áp migration + seed **từ máy local** trỏ vào DB production (một lần):
   ```bash
   DATABASE_URL="<production url>" npm run db:deploy
   DATABASE_URL="<production url>" ADMIN_EMAIL="admin@hussio.com" ADMIN_PASSWORD="<mật khẩu mạnh>" npm run db:seed
   ```
   Seed idempotent: chạy lại không ghi đè dữ liệu đã có.

## 2. Tạo project trên Vercel

1. Đẩy source lên GitHub (private repo).
2. Vercel → **Add New Project** → import repo. Framework: Next.js (tự nhận).
3. Build command giữ mặc định `npm run build` (đã gồm `prisma generate`).
4. **Environment Variables** (Production):

| Biến | Giá trị |
|---|---|
| `DATABASE_URL` | pooled URL ở bước 1 |
| `APP_URL` | `https://quay.hussio-vn.com` |
| `NEXT_PUBLIC_SHOP_URL` | `https://hussio.com` |
| `ADMIN_SESSION_SECRET` | chuỗi ngẫu nhiên 64 ký tự |
| `PHONE_HASH_SECRET` | chuỗi ngẫu nhiên 64 ký tự — **không đổi sau khi đã phát mã** |
| `SHOPIFY_SHOP_DOMAIN` | `<store>.myshopify.com` |
| `SHOPIFY_API_VERSION` | `2026-10` |
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` | Client ID / secret của app Dev Dashboard |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | (tuỳ chọn) token tĩnh nếu dùng custom app cũ |
| `SHOPIFY_WEBHOOK_SECRET` | secret ký webhook (xem SHOPIFY_SETUP.md) |
| `SHOPIFY_WRITE_ORDER_TAGS` | `true` nếu muốn gắn tag + metafield vào đơn |

Tạo secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

5. Deploy. Kiểm tra `https://<project>.vercel.app/api/health` trả `{"ok":true,"database":"up"}`.

## 3. Trỏ tên miền quay.hussio-vn.com (DNS)

Domain `hussio-vn.com` đang dùng cho `khaosat.hussio-vn.com`, chỉ cần thêm **một bản ghi** cho subdomain `quay` — không đụng các bản ghi hiện có.

1. Vercel → Project → **Settings → Domains** → Add `quay.hussio-vn.com`.
2. Tại nhà cung cấp DNS của `hussio-vn.com` thêm:

| Type | Name / Host | Value | TTL |
|---|---|---|---|
| `CNAME` | `quay` | `cname.vercel-dns.com` (hoặc giá trị Vercel hiển thị) | Auto / 3600 |

3. Nếu DNS dùng **Cloudflare**: đặt bản ghi ở chế độ **DNS only** (mây xám) để Vercel cấp SSL; hoặc bật proxy sau khi chứng chỉ đã cấp, SSL mode **Full (strict)**.
4. Nếu Vercel yêu cầu xác minh (domain đang thuộc team khác) thêm bản ghi `TXT _vercel` theo hướng dẫn trên màn hình.
5. Đợi Vercel báo **Valid Configuration**, SSL tự cấp. Mở https://quay.hussio-vn.com.

## 4. Sau khi lên production

- Đăng nhập `https://quay.hussio-vn.com/admin` → **Cài đặt** → đổi mật khẩu, tạo tài khoản STAFF cho nhân viên Facebook / cửa hàng.
- **Cài đặt → Kiểm tra kết nối** (chỉ đọc) để xác nhận Shopify.
- Đăng ký webhook (SHOPIFY_SETUP.md §4) — chỉ sau khi merchant duyệt.
- **Chương trình**: kiểm tra ngày, ngưỡng, COD mode, rồi chuyển trạng thái **ACTIVE** khi bắt đầu.
- **Kho quà tặng**: import danh sách SKU/size thực tế từ Gift Sheet nếu có.
- Theo dõi **Dashboard** và **Webhook gần đây** trong ngày đầu.

## 5. Rollback

- Vercel → Deployments → chọn bản trước → **Promote to Production** (tức thì).
- Migration chỉ thêm bảng/cột; nếu cần quay lại schema, khôi phục backup DB (Neon/Supabase có point-in-time restore) — không chạy `migrate reset` trên production.
- Tạm dừng chương trình nhanh nhất: Admin → Chương trình → **PAUSED** (khách thấy "Chương trình đang tạm dừng", mã không bị mất).

## 6. Cloudflare (tuỳ chọn)

Mặc định là Vercel. Nếu muốn chạy trên Cloudflare: dùng adapter OpenNext cho Cloudflare Workers và Hyperdrive cho PostgreSQL. Code không phụ thuộc API riêng của Vercel (chỉ dùng `after()` của Next.js), nhưng cần test lại trước khi chuyển.
