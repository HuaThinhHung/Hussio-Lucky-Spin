# HUSSIO LUCKY SPIN — Black Friday 2026

Web vòng quay may mắn độc lập tại **https://quay.hussio-vn.com**, kết nối Shopify HUSSIO.

**Mua từ 1.300.000đ → nhận 01 mã quay → 100% có quà.** Áp dụng cho đơn Website (Shopify), Facebook và Cửa hàng.

- Khách nhập **mã + số điện thoại mua hàng** → server xác minh → bấm **QUAY NGAY** → **server chọn giải** (crypto RNG, transaction) → vòng quay dừng đúng ô server trả về → voucher / quà sản phẩm.
- Mỗi mã quay **đúng 1 lần** — chống double-click, refresh, nhiều tab, request đồng thời (khoá dòng + ràng buộc UNIQUE). Nhập lại mã đã quay → hiện lại kết quả.
- Admin: phát mã Facebook/Cửa hàng, import CSV, chỉnh tỷ lệ & kho quà, trao quà, voucher, analytics.
- Shopify: webhook tự cấp mã cho đơn Website, tạo discount code dùng 1 lần cho voucher, huỷ thưởng khi huỷ/hoàn đơn.

| Tài liệu | Nội dung |
|---|---|
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Vercel, biến môi trường, migration production, **DNS quay.hussio-vn.com**, rollback |
| [docs/SHOPIFY_SETUP.md](docs/SHOPIFY_SETUP.md) | Tạo app Dev Dashboard, scopes, **webhook**, COD, voucher Shopify |
| [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md) | Hướng dẫn nhân viên & admin vận hành |
| [docs/marketing/CONTENT.md](docs/marketing/CONTENT.md) | Bài Facebook, promo bar, thông điệp giỏ hàng, QR cửa hàng, kịch bản CSKH |

---

## Tech stack

| | |
|---|---|
| Framework | Next.js 16.4 (App Router, Turbopack), React 19.3, TypeScript (strict) |
| UI | Tailwind CSS 4, font Be Vietnam Pro + Playfair Display, SVG wheel + CSS transform |
| Database | PostgreSQL + Prisma ORM 7 (`@prisma/adapter-pg`) |
| Shopify | `@shopify/admin-api-client` — Admin GraphQL API `2026-10` |
| Test | Vitest 5 (unit + integration trên PostgreSQL thật), Playwright (375px + desktop) |
| Deploy | Vercel + PostgreSQL managed (Neon / Vercel Postgres / Supabase) |

## Chạy local (Windows / macOS / Linux, Node ≥ 22.12)

```bash
npm install
cp .env.example .env          # Windows: copy .env.example .env  → điền các secret
npm run db:local              # terminal 1: PostgreSQL nhúng tại 127.0.0.1:5544 (không cần Docker)
npm run db:migrate            # terminal 2: tạo bảng
npm run db:seed               # chương trình BF 2026 + 9 giải + 172 quà + tài khoản admin
npm run dev                   # http://localhost:3000  ·  admin: http://localhost:3000/admin
```

- Đã có PostgreSQL/Docker? Bỏ `db:local`, chỉ cần đặt `DATABASE_URL`.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` trong `.env` là tài khoản admin đầu tiên (để trống mật khẩu → seed sinh ngẫu nhiên và in ra 1 lần).
- Chương trình seed ở trạng thái **DRAFT** (bắt đầu 01/11/2026). Để thử quay ngay: Admin → **Chương trình** → ACTIVE + đặt ngày bắt đầu = hôm nay → **Tạo mã quay** → ra trang chủ nhập mã.
- Shopify chưa cấu hình = **MOCK mode** (voucher không tạo trên Shopify). Thử webhook: `npm run shopify:simulate -- paid 1450000 --order=#9001`.

### Scripts

| Lệnh | Việc |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` · `lint` · `test` | TypeScript · ESLint · Vitest (tự bật PostgreSQL tạm cho test) |
| `npm run test:e2e` | Playwright (cần `npm run dev` đang chạy, dùng Chrome đã cài) |
| `npm run db:local` | PostgreSQL nhúng cho dev |
| `npm run db:migrate` · `db:deploy` · `db:seed` · `db:studio` | Prisma |
| `npm run admin:create -- email "Tên" STAFF` | Tạo tài khoản / `--reset` mật khẩu |
| `npm run shopify:webhooks [-- --confirm]` | Đăng ký webhook (mặc định chạy thử) |
| `npm run shopify:simulate -- paid 1450000` | Gửi webhook giả có HMAC tới localhost |
| `npm run qr` | Xuất QR `quay.hussio-vn.com` (SVG + PNG) cho cửa hàng |

## Biến môi trường

Xem [.env.example](.env.example). Không có secret nào trong source code.

| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `DATABASE_URL` | ✔ | PostgreSQL |
| `APP_URL` | ✔ | `https://quay.hussio-vn.com` |
| `NEXT_PUBLIC_SHOP_URL` | ✔ | `https://hussio.com` |
| `ADMIN_SESSION_SECRET` | ✔ | ≥ 32 ký tự ngẫu nhiên |
| `PHONE_HASH_SECRET` | ✔ | ≥ 32 ký tự ngẫu nhiên, **không đổi** sau khi phát mã |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | seed | tài khoản admin đầu tiên |
| `SHOPIFY_SHOP_DOMAIN` | Shopify | `<store>.myshopify.com` — **merchant điền sau** |
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` | Shopify | Client ID/secret app Dev Dashboard — **merchant điền sau** |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | tuỳ chọn | token tĩnh thay cho client credentials |
| `SHOPIFY_WEBHOOK_SECRET` | Shopify | secret ký webhook (mặc định = API secret) |
| `SHOPIFY_API_VERSION` | | `2026-10` |
| `SHOPIFY_WRITE_ORDER_TAGS` | | `true` để gắn tag + metafield vào đơn |

---

## Cấu trúc project

```
hussio-lucky-spin/
├─ prisma/
│  ├─ schema.prisma              # 15 model (Campaign, LuckyCode, Spin, Prize, GiftPool, GiftItem, Voucher, Winner, WebhookEvent, AdminAuditLog, …)
│  ├─ migrations/…_init/         # migration SQL
│  ├─ seed-data.ts               # dữ liệu mặc định (giải, kho quà từ Gift Sheet)
│  └─ seed.ts
├─ src/
│  ├─ app/
│  │  ├─ page.tsx                # trang khách: hero → nhập mã → vòng quay → kết quả → người may mắn → cách tham gia → quà → thể lệ → CTA
│  │  ├─ api/lucky/{validate,spin,confirm}/   # API khách (rate limit, same-origin)
│  │  ├─ api/winners/            # feed người trúng ẩn danh
│  │  ├─ api/events/             # analytics phía client (voucher_copied, shop_now_clicked)
│  │  ├─ api/webhooks/shopify/   # webhook HMAC + idempotent
│  │  ├─ api/health/
│  │  └─ admin/                  # login + (panel): dashboard, codes, new, import, winners, vouchers, prizes, inventory, campaign, analytics, settings
│  ├─ components/{home,spin,admin,brand}/
│  ├─ lib/                       # thuần (client + server): codes, phone, name-mask, weighted-random, wheel, format, types
│  ├─ server/                    # chỉ server: spin engine, lucky-codes, gifts, vouchers, rewards, winners, auth, security, shopify/*
│  └─ proxy.ts                   # chặn /admin khi chưa có cookie phiên
├─ tests/{unit,integration,helpers}/   # Vitest
├─ e2e/                          # Playwright (375px / desktop)
├─ scripts/                      # local-db, create-admin, shopify webhooks/simulate, QR
├─ shopify-theme/snippets/       # promo bar + cart message (chưa cài, dùng cho bản sao theme)
└─ docs/                         # triển khai, Shopify, admin, marketing (+ QR)
```

## Database

```
Campaign 1─* Prize *─0..1 GiftPool 1─* GiftItem
Campaign 1─* LuckyCode 1─0..1 Spin ─1 Prize
                               Spin ─0..1 GiftItem
                               Spin 1─0..1 Voucher
                               Spin 1─1 Winner
WebhookEvent · AdminUser 1─* AdminSession · AdminAuditLog · AnalyticsEvent · RateLimitBucket
```

Ràng buộc chính:
- `LuckyCode.code` UNIQUE · `(campaignId, channel, orderReference)` UNIQUE → **1 đơn = 1 mã**.
- `Spin.luckyCodeId` UNIQUE → **1 mã = 1 lượt quay** ở mức database.
- `Voucher.code` UNIQUE · `Voucher.spinId` UNIQUE · `Winner.spinId` UNIQUE · `WebhookEvent.webhookId` UNIQUE.
- Trạng thái mã: `PENDING` (chờ duyệt COD) · `ACTIVE` · `USED` · `CANCELLED` · `EXPIRED`. Người trúng: `WON` · `CONFIRMED` · `FULFILLED` · `VOID`.
- Tiền lưu dạng số nguyên VND. Số điện thoại chỉ lưu **HMAC-SHA256** + 3 số cuối.

## Thuật toán quay (server-side)

`POST /api/lucky/spin` → `src/server/spin.ts`

1. Rate limit theo IP (PostgreSQL, chạy được trên serverless) + kiểm tra Origin.
2. Chuẩn hoá mã, so khớp SĐT (hash, so sánh constant-time). Sai 5 lần → khoá mã 30 phút.
3. Mã `USED` → trả lại **đúng kết quả cũ** (không quay lại).
4. Kiểm tra trạng thái mã, hạn dùng, chương trình ACTIVE trong khung giờ.
5. **Transaction**: `SELECT … FOR UPDATE` dòng LuckyCode → lấy giải đang hiển thị theo thứ tự vòng quay → loại giải hết quota / hết kho → **`crypto.randomInt(tổng trọng số)`** chọn giải → giữ quota (`UPDATE … WHERE stockUsed < stockLimit`) → nếu là quà sản phẩm, chọn 1 GiftItem còn hàng (random theo số lượng) và trừ kho có điều kiện → tạo Spin, Voucher (`HUSSIO-WHEEL-XXXXXX`, 30 ngày), Winner → đánh dấu mã `USED` → commit.
6. Request đồng thời cùng mã chờ khoá; request sau thấy `USED` và nhận cùng kết quả. Vi phạm UNIQUE cũng được xử lý thành "trả kết quả cũ".
7. Trả về `segmentIndex` (+ `prizeId`); trình duyệt chỉ chạy animation (4.6s, nhanh → chậm → dừng; `prefers-reduced-motion` → 0.5s). Voucher được tạo trên Shopify **sau khi trả response** (`after()`), lỗi thì admin đồng bộ lại.

Không có `Math.random()` trong quyết định giải. Mã quay/voucher sinh bằng `crypto.randomInt` trên bảng 32 ký tự (bỏ 0/O/1/I).

## Bảo mật

- Admin: mật khẩu scrypt, phiên = token ngẫu nhiên 256-bit trong cookie httpOnly/SameSite=Lax/Secure, DB chỉ lưu HMAC token; `requireAdmin()` ở mọi trang + server action; phân quyền ADMIN/STAFF; rate limit đăng nhập; audit log mọi thao tác.
- CSRF: server action của Next.js kiểm tra Origin; API JSON từ chối Origin lạ; cookie SameSite.
- Validate & làm sạch input (zod, giới hạn độ dài, bỏ ký tự điều khiển); CSV export chống formula injection.
- Webhook: HMAC constant-time trên raw body, kiểm tra shop domain, idempotent.
- Không bao giờ lộ: token Shopify, mật khẩu DB, SĐT, email, mã đơn, địa chỉ. Feed người trúng chỉ có tên đã che, tỉnh/thành, giải, thời gian.
- Header: `X-Frame-Options DENY`, `nosniff`, HSTS, Referrer-Policy, Permissions-Policy; `/admin` `noindex`.

## Kiểm thử

```bash
npm run typecheck && npm run lint && npm test && npm run build
npm run dev   # rồi ở terminal khác:
npm run test:e2e
```

Vitest (69 test) — integration chạy trên PostgreSQL thật (embedded, tự bật/tắt):

| Nhóm | Kiểm tra |
|---|---|
| Mã | 1.300.000đ → tạo mã · 1.299.000đ → từ chối · 2.600.000đ → vẫn 1 mã · trùng đơn (kể cả gửi đồng thời) → không tạo thêm · CSV hợp lệ/lỗi |
| Quay | mã hợp lệ → đúng 1 giải · quay lại → cùng kết quả · **8 request đồng thời → 1 lượt quay** · SĐT sai / khoá 5 lần · hết hạn · tạm dừng · kết thúc |
| Kho | Polo hết → không bao giờ ra Polo · hết toàn bộ quà sản phẩm → vẫn ra voucher · trúng quà → kho giảm · quota · VOID → kho cộng lại · chọn size theo tồn |
| Privacy | API người trúng không có SĐT/email/mã đơn/mã quay · không có người trúng ảo |
| Shopify | HMAC đúng/sai · webhook lặp idempotent · COD 3 chế độ · huỷ trước/sau quay · voucher đã dùng · payload discount |
| Toán học | random có trọng số đúng phân phối · vòng quay luôn dừng đúng ô · màu ô không trùng kề nhau |

Playwright (375px + desktop): đủ section, **không tràn ngang ở 375px**, vòng quay vừa màn hình, lỗi mã thân thiện, API không lộ PII, /admin yêu cầu đăng nhập.

## Ghi chú & bước tiếp theo

- **Gift Sheet**: tab "7.Gifts list" mới có tổng theo nhóm (172 sp / 16.282.700đ), chưa có size → seed 1 dòng/nhóm với giá vốn trung bình (tổng tính lại 16.282.704đ do làm tròn). Import danh sách SKU/size thật trong Admin → Kho quà tặng.
- Nhiều lượt theo giá trị đơn (2.600.000đ = 2 lượt): đã có cờ `multiSpinEnabled` trong schema, tắt trong MVP.
- Thông điệp giỏ hàng & promo bar trên hussio.com: snippet sẵn trong `shopify-theme/`, cài vào bản sao theme khi được duyệt.
- GA4: chưa cần — mọi sự kiện lưu trong bảng `AnalyticsEvent`.
#   H u s s i o - L u c k y - S p i n  
 