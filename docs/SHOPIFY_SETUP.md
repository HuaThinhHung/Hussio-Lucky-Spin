# Kết nối Shopify HUSSIO

Web vòng quay chạy độc lập nhưng kết nối Shopify qua **Admin GraphQL API (2026-10)** để:

1. Tự cấp mã Lucky Spin cho đơn Website đủ điều kiện (webhook).
2. Tạo **mã giảm giá riêng, dùng 1 lần** cho mỗi voucher trúng thưởng.
3. (Tuỳ chọn) gắn tag `hussio-lucky-spin` + metafield `hussio.lucky_code` vào đơn.
4. Huỷ mã / void phần thưởng khi đơn bị huỷ hoặc hoàn toàn bộ; đánh dấu voucher đã dùng.

Token Admin API **chỉ nằm trên server** (biến môi trường Vercel), không bao giờ gửi ra trình duyệt.

> Khi chưa điền thông tin Shopify, hệ thống chạy **MOCK mode**: mọi thứ hoạt động, voucher có mã nhưng chưa tồn tại trên Shopify (trạng thái "MOCK") và đơn Website phải nhập tay. Admin hiển thị banner cảnh báo.

---

## 1. Tạo app cho HUSSIO

Từ 01/01/2026 Shopify không cho tạo "custom app" kiểu cũ trong admin nữa → dùng **Dev Dashboard**:

1. Vào https://dev.shopify.com → **Apps → Create app** → đặt tên `HUSSIO Lucky Spin`.
2. **Versions → Create version** → khai báo Admin API scopes:

| Scope | Lý do |
|---|---|
| `read_orders` | Đọc đơn (webhook đơn hàng, kiểm tra trạng thái) |
| `write_orders` | Chỉ cần nếu bật gắn tag/metafield vào đơn (`SHOPIFY_WRITE_ORDER_TAGS=true`) |
| `write_discounts` (kèm `read_discounts`) | Tạo / vô hiệu hoá mã voucher vòng quay |

   Không cần scope nào khác. Release version.
3. **Install** app lên store HUSSIO (store phải cùng organization với app).
4. **Settings** → copy **Client ID** → `SHOPIFY_API_KEY`, **Client secret** → `SHOPIFY_API_SECRET`.
5. `SHOPIFY_SHOP_DOMAIN` = `<tên-store>.myshopify.com` (không phải hussio.com).

Hệ thống tự lấy access token bằng **client credentials grant** (token sống 24h, tự làm mới, cache trên server).

> Nếu HUSSIO đã có custom app cũ với token `shpat_...` thì có thể điền `SHOPIFY_ADMIN_ACCESS_TOKEN` thay cho client credentials.

## 2. Đơn hàng nào được cấp mã tự động?

Quy tắc (giống khi nhân viên tạo tay):

- **Tiền hàng sau giảm giá** (`subtotal_price` / `current_subtotal_price`) **≥ 1.300.000đ** — không tính phí ship.
- Đơn tạo trong khung `Bắt đầu` → `Hạn chót đặt đơn` của chương trình ACTIVE.
- Mỗi đơn đúng **01 mã** (unique theo chương trình + kênh + mã đơn `#1234`).
- **Trả trước**: cấp khi đơn **PAID** (`orders/paid`, hoặc `orders/create` nếu đã paid).
- **COD** (cổng "Cash on Delivery (COD)" / "Thanh toán khi nhận hàng") theo cài đặt **Chương trình → Đơn COD**:
  - `CONFIRMED_ORDER` (mặc định): cấp ngay khi đơn được tạo/xác nhận.
  - `PAID`: chờ đơn được đánh dấu đã thu tiền.
  - `MANUAL_APPROVAL`: tạo mã ở trạng thái **Chờ duyệt**, nhân viên bấm **Duyệt** trong Admin → Mã quay.
- Đơn không có số điện thoại → bỏ qua (ghi chú trong Webhook gần đây), nhân viên cấp tay.

Khách Website nhận mã thế nào? CS lọc kênh **Website** trong Admin → Mã quay → **Copy tin nhắn** gửi qua Zalo/SMS. Nếu bật `SHOPIFY_WRITE_ORDER_TAGS`, mã cũng nằm trong metafield `hussio.lucky_code` của đơn — có thể chèn vào email "Đơn hàng đã giao" bằng `{{ order.metafields.hussio.lucky_code }}` (kiểm tra trên theme/notification bản nháp trước).

## 3. Huỷ / hoàn đơn

- `orders/cancelled` hoặc `orders/updated` với `financial_status = refunded`:
  - Mã **chưa quay** → `CANCELLED`.
  - Mã **đã quay** → lượt quay giữ lịch sử, phần thưởng → `VOID` (nếu chưa trao/chưa dùng), quà trả về kho, mã giảm giá Shopify bị vô hiệu hoá.
- `refunds/create` được ghi nhận; hoàn **một phần** không huỷ thưởng.

## 4. Đăng ký webhook (sau khi merchant duyệt)

**Cách A — script (khuyến nghị)**, chạy từ máy có `.env` production:

```bash
npm run shopify:webhooks              # chạy thử, chỉ in ra
npm run shopify:webhooks -- --confirm # tạo thật trên store
```

Đăng ký `ORDERS_CREATE`, `ORDERS_PAID`, `ORDERS_UPDATED`, `ORDERS_CANCELLED`, `REFUNDS_CREATE` → `https://quay.hussio-vn.com/api/webhooks/shopify`. Webhook của app được ký bằng **Client secret** → để `SHOPIFY_WEBHOOK_SECRET` trống (tự dùng `SHOPIFY_API_SECRET`) hoặc điền cùng giá trị.

**Cách B — thủ công trong Shopify admin**: Settings → Notifications → Webhooks → Create webhook cho từng sự kiện *Order creation, Order payment, Order update, Order cancellation, Refund create*, format **JSON**, URL như trên, API version **2026-10**. Copy chuỗi "Your webhooks will be signed with …" vào `SHOPIFY_WEBHOOK_SECRET`.

Bảo mật & độ tin cậy:
- Xác minh **HMAC** `X-Shopify-Hmac-Sha256` trên raw body (so sánh constant-time) → sai trả 401.
- **Idempotent**: lưu `X-Shopify-Webhook-Id` (unique). Shopify gửi lại → bỏ qua, không tạo mã trùng. Lỗi bất ngờ trả 500 để Shopify retry, lần sau được xử lý lại.
- Chỉ nhận webhook từ đúng `SHOPIFY_SHOP_DOMAIN`.

## 5. Voucher trên Shopify

Mỗi voucher trúng thưởng = 1 discount code riêng (`discountCodeBasicCreate` / `discountCodeFreeShippingCreate`):

- Mã `HUSSIO-WHEEL-XXXXXX`, `usageLimit = 1`, `appliesOncePerCustomer`, áp cho mọi khách (`context: ALL`).
- Giá trị và **đơn tối thiểu** theo từng giải (Admin → Giải thưởng). Mặc định: 30K/399K, 50K/599K, 100K/899K, Freeship không tối thiểu.
- Hạn dùng: **Chương trình → Thời hạn voucher** (mặc định 30 ngày).
- **Cộng dồn**: mặc định KHÔNG cộng với giảm giá khác. Bật/tắt từng loại tại **Chương trình → Cho phép cộng dồn với** (đối chiếu chương trình Black Friday trước khi bật).
- Tạo sau khi khách quay (chạy nền, không làm chậm vòng quay). Lỗi → trạng thái "Lỗi đồng bộ", admin bấm **Đồng bộ Shopify** ở trang Voucher.
- Khi khách dùng mã ở đơn sau, webhook đơn hàng đánh dấu voucher **REDEEMED**.

## 6. Kiểm thử an toàn (không đụng store thật)

- Dùng **dev store** tạo từ Dev Dashboard để thử đầy đủ.
- Local không cần Shopify: `npm run shopify:simulate -- paid 1450000 --order=#9001` gửi webhook giả có chữ ký HMAC tới `localhost` (script từ chối gửi ra ngoài localhost).
