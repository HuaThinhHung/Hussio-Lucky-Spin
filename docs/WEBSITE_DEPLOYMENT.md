# Lucky Spin độc quyền website — triển khai & vận hành

Khách mua trên hussio.com (đơn từ 1.300.000đ tiền hàng sau giảm, **kể cả COD**) → bấm nút "QUAY QUÀ" trong email xác nhận
(mã đơn được điền sẵn) → **chọn size** → nhập SĐT/email đặt hàng → quay → quà + size + màu ghi vào Google Sheet
và (tuỳ chọn) ghi tag + ghi chú lên đơn Shopify để kho đóng gói kèm.

```
Shopify đơn web ──► Email xác nhận (nút QUAY QUÀ ?order=1284)
                         │
                         ▼
   Web app Apps Script (Index.html) ── google.script.run ──► WebsiteOrders.gs
        chọn size · nhập SĐT/email                           │  1. đọc đơn trên Shopify (Admin API)
                                                             │  2. kiểm tra điều kiện, khoá chống quay trùng
                                                             │  3. bốc quà theo size còn tồn
                                                             ▼
                               Sheet vận hành: WEB_RESULTS (1 dòng / đơn) ──► Shopify: tag LUCKY-SPIN + ghi chú quà
```

## 1. Thành phần

| File | Vai trò |
|---|---|
| `apps-script/Code.gs` | Trang web (`doGet`), menu HUSSIO, hàm dùng chung |
| `apps-script/WebsiteOrders.gs` | Xác minh đơn Shopify, bốc quà theo size, ghi kết quả, API JSON (`doPost`) |
| `apps-script/WebsiteAdmin.gs` | Menu cho CS/kho: tra cứu, đánh dấu đã đóng gói, huỷ quà, nạp size, kết nối Shopify |
| `apps-script/WebCatalog.gs` | Danh sách 46 mẫu quà (tab "7.Gifts list") + 9 quà phụ kiện/voucher cũ, dùng khi tạo bảng lần đầu |
| `apps-script/Index.html` | Giao diện khách (build từ `src/` bằng `node scripts/build-apps-script.mjs`) |
| `shopify-theme/notifications/order-confirmation-lucky-spin.liquid` | Nút QUAY QUÀ trong email xác nhận đơn |

## 2. Cài đặt (làm một lần)

### Bước 1 — Đưa code lên Apps Script
1. Mở Sheet vận hành `hussio-lucky-spin` → **Tiện ích mở rộng → Apps Script**.
2. Tạo/ghi đè các file: `Code.gs`, `WebCatalog.gs`, `WebsiteOrders.gs`, `WebsiteAdmin.gs`, `Index.html`
   (chạy `node scripts/build-apps-script.mjs` trước để có `Index.html` mới nhất).
3. Bật "Hiển thị tệp kê khai appsscript.json" trong Project Settings và dán nội dung `apps-script/appsscript.json`.
4. Lưu, quay lại Sheet, tải lại trang → xuất hiện menu **HUSSIO**.

### Bước 2 — Tạo / nâng cấp bảng
Menu **HUSSIO → Tạo / cập nhật bảng website**. Lệnh này không xoá dữ liệu, chỉ:
- ghi tiêu đề 14 cột cho `WEB_RESULTS`;
- thêm cột **Trọng số** (để trống = 1) cho `WEB_GIFT_LIMITS`;
- thêm `SPIN_UNTIL`, `ALLOW_SHIPPED_ORDERS`, `ZALO_URL` vào `CAU_HINH`.

### Bước 3 — Kết nối Shopify ("dùng ứng dụng Shopify đang có")
Cửa hàng: `sbczjd-yj.myshopify.com` (domain hussio.com).
1. Vào **Dev Dashboard** (dev.shopify.com) bằng tài khoản quản trị HUSSIO. Dùng app đang có nếu app đó cùng
   tổ chức (organization) với cửa hàng; nếu chưa có thì tạo app mới.
2. Trong phiên bản app (Versions): bật scope **`read_orders`** (và **`write_orders`** nếu muốn ghi quà lên đơn).
3. **Protected customer data access**: chọn Name, Email, Phone, Address — thiếu bước này hệ thống không đọc được
   SĐT/email để xác minh khách.
4. Release phiên bản và cài/duyệt app trên cửa hàng HUSSIO.
5. Trong Sheet: **HUSSIO → Cài đặt kết nối Shopify** → để trống tên miền (mặc định `sbczjd-yj.myshopify.com`) →
   dán **Client ID** và **Client secret** (App → Settings). Token 24h được tự xin và tự gia hạn.
   Nếu dùng token tĩnh `shpat_…` thì để trống Client ID và dán token ở bước sau.
6. Chọn **Có** ở câu "Ghi quà lên đơn Shopify?" để mỗi lượt quay thêm tag `LUCKY-SPIN`, tag `QUA-<SKU>` và
   một dòng ghi chú `[LUCKY SPIN] Quà tặng kèm: … · Size … · Màu … · SKU …` vào đơn.
7. Màn hình kiểm tra hiện: tên shop, có/thiếu `read_orders`, `write_orders`, và đơn web gần nhất có đọc được
   email/SĐT không. Có thể chạy lại bất cứ lúc nào: **HUSSIO → Kiểm tra kết nối Shopify**.

Không dán Client secret/token vào Sheet, chat hay code. Chúng chỉ nằm trong Script Properties.

### Bước 4 — Quỹ quà và size
- `WEB_GIFT_LIMITS`: mỗi quà một dòng — **Hạn mức** (tổng số chiếc được phát), **Bật** (tick), **Trọng số**
  (tỷ lệ tương đối, để trống = 1; 0 = không bốc). Thứ tự dòng = thứ tự ô trên vòng quay.
- `WEB_GIFT_VARIANTS`: mỗi SKU/size/màu một dòng — **Nhóm** `top` (áo/polo/khoác/sơ mi), `pants` (quần),
  `any` (vớ, mũ, thắt lưng, voucher, hộp — không cần size); **Số lượng dành cho quà**; **Bật**.
- **HUSSIO → Nạp size từ file tồn kho** đọc file "PHÂN LOẠI TỒN KHO", khớp tên (bỏ dấu, bỏ chữ "ÁO") và thêm
  SKU/size/màu ở trạng thái TẮT. Hiện chỉ **ÁO POLO LUCUS V2** có trong file tồn; 45 mẫu còn lại (TIZI, GRAVAS,
  BENZIMA, BUBERANT…) không có trong file này nên kho cần nhập size tay (xem `docs/doi-chieu-qua-size.csv`).
- Số lượng nạp từ file là **tồn bán hàng**: sửa thành số chiếc thực sự dành cho quà rồi mới tick Bật.

Vòng quay đọc trực tiếp hai bảng này (cache 30 giây): sửa Sheet là vòng quay cập nhật, size hết tự mờ đi.
Quà đã trúng được trừ dựa trên `WEB_RESULTS`; dòng chuyển sang `HUY` trả quà về quỹ.

### Bước 5 — Thời gian & tuỳ chọn (`CAU_HINH`)
| Khoá | Ý nghĩa |
|---|---|
| `STATUS` | `OPEN` mới cho quay. Giữ `PAUSED` khi chưa kiểm thử xong |
| `STARTS_AT`, `ENDS_AT` | Đơn phải được **đặt** trong khoảng này (ISO, ví dụ `2026-11-01T00:00:00+07:00`) |
| `SPIN_UNTIL` | Hạn cuối được quay. Trống = `ENDS_AT` + 3 ngày (cho đơn đặt sát giờ) |
| `MIN_ORDER` | 1300000 |
| `ALLOW_SHIPPED_ORDERS` | `TRUE` (mặc định): đơn đã giao vẫn quay, quà ghi `GUI_RIENG` để CS gửi riêng. `FALSE`: chặn |
| `ZALO_URL` | Link Zalo OA (`https://zalo.me/...`) → nút "NHẮN ZALO HUSSIO" sau khi quay, tự sao chép mã đơn + quà |

### Bước 6 — Triển khai web app
Apps Script → **Deploy → New deployment → Web app** → Execute as: **Me**, Who has access: **Anyone** →
copy link `/exec` vào `CAU_HINH.WEB_APP_URL`. Mỗi lần sửa code: **Manage deployments → Edit → New version**
(giữ nguyên link).

### Bước 7 — Nút QUAY QUÀ trong email xác nhận đơn
Shopify admin → Settings → Notifications → **Order confirmation** → Edit code → dán
`shopify-theme/notifications/order-confirmation-lucky-spin.liquid` sau lời cảm ơn, thay `LINK_VONG_QUAY` bằng
link `/exec` → **Send test email** → Save. Nút chỉ hiện với đơn có tiền hàng ≥ 1.300.000đ.

### (Tuỳ chọn) Dùng tên miền quay.hussio-vn.com
- Deploy thư mục Next.js lên Vercel, đặt biến `NEXT_PUBLIC_SHEET_API_URL` = link `/exec`. Trang gọi API
  `doPost` của Apps Script (POST `text/plain`, `{action: "catalog" | "validate" | "spin", ...}`).
- Hoặc nhúng web app vào một Page trên hussio.com bằng `<iframe src="LINK/exec">` (đã cho phép nhúng).

## 3. Quy tắc hệ thống
- Chỉ đơn **website** (`sourceName = web`), không phải đơn test, chưa huỷ, thanh toán không ở trạng thái
  VOIDED/REFUNDED/EXPIRED. **COD (PENDING) được chấp nhận** — 100% đơn web hiện tại của HUSSIO là COD.
- Tiền hàng sau giảm (`currentSubtotalPrice`, đã trừ hoàn/sửa đơn) ≥ 1.300.000đ, tiền VND.
- Xác minh bằng SĐT (mọi kiểu viết: 09…, +84…, có dấu cách) hoặc email đặt hàng. Sai 5 lần → khoá mã đơn 30 phút.
- **Mỗi đơn 1 lượt** (đơn 2.600.000đ vẫn 1 lượt). Một dòng `WEB_RESULTS` vừa là kết quả vừa là phần trừ kho,
  ghi dưới khoá ScriptLock nên không thể quay trùng hay vượt tồn.
- Bốc quà: chọn món theo **Trọng số** trong các món còn quà đúng size đã chọn (+ món không cần size), rồi chọn
  SKU/màu theo số còn lại. Hết size đã chọn → báo "Size bạn chọn vừa hết quà", khách giữ nguyên lượt và chọn size khác.
- Mở lại trang, nhập lại mã đơn → xem lại đúng kết quả cũ (kể cả sau khi chương trình kết thúc).

## 4. Vận hành hằng ngày (CS & kho)
`WEB_RESULTS` — mỗi đơn một dòng: Ngày quay · Mã đơn · SĐT/email · Tiền hàng · **Quà trúng · Size · Màu · SKU** ·
**Trạng thái quà** · Ghi lên Shopify · Shopify ID · ID quà · JSON · Ghi chú CS.

| Trạng thái | Việc cần làm |
|---|---|
| `CHO_DONG_GOI` | Kho đóng quà vào đơn (lọc đơn Shopify theo tag `LUCKY-SPIN`), xong → **HUSSIO → Đánh dấu đã đóng gói quà** |
| `GUI_RIENG` | Đơn đã giao trước lúc quay: CS liên hệ khách, gửi quà riêng |
| `DA_DONG_GOI` | Hoàn tất |
| `HUY` | Đơn huỷ/hoàn: **HUSSIO → Huỷ quà**; quà trả về quỹ, đơn không được quay lại |

- Cột "Ghi lên Shopify": `ĐÃ GHI` / `CHƯA BẬT` / `LỖI: …` (lỗi thì kho thêm ghi chú tay; lượt quay vẫn hợp lệ).
- Tra nhanh một đơn: **HUSSIO → Tra cứu đơn website**.
- Không sửa tay các cột Quà/Size/SKU/JSON. Không chia sẻ Sheet cho khách.

## 5. Kiểm thử đã chạy
```bash
node scripts/test-website-orders.mjs   # 23 kiểm tra backend Apps Script trên Sheet/Shopify giả lập
npm run typecheck && npm run lint
npm test                               # 69 test Vitest (hệ thống cũ)
npx playwright test                    # 14 test giao diện mobile 375px + desktop (cần npm run dev)
```
Ngoài ra đã chạy giao diện Apps Script thật trong trình duyệt với code server thật trên Sheet giả lập: chọn size →
vòng quay mờ đúng món, đơn COD hợp lệ, chặn quay khi chưa chọn size, kim dừng đúng món server bốc, ghi đúng 1 dòng,
mở lại xem kết quả cũ, đơn < 1,3tr / đã huỷ / sai SĐT / không tồn tại, đơn đã giao (GUI_RIENG), size hết giữa chừng.

**Chưa kiểm thử với Shopify và Google Sheet thật** — cần làm sau Bước 3–6: tạo 1 đơn web thật ≥ 1.300.000đ, quay
thử, kiểm tra dòng `WEB_RESULTS` và tag/ghi chú trên đơn, rồi chuyển dòng đó sang `HUY` trước khi mở chương trình.

## 6. Giới hạn còn lại
- 45/46 mẫu quà chưa có dữ liệu size → kho phải nhập trước khi mở, nếu không các món này luôn tối và không thể trúng.
- Zalo OA: nút mở chat OA + sao chép thông tin; chưa gửi tin tự động qua Zalo OA API (cần token OA và mẫu ZNS được duyệt).
- Voucher 10K–50K: chưa tạo mã giảm giá tự động trên Shopify; CS áp dụng thủ công theo đơn.
- Chống dò mã đơn dựa trên khoá theo mã đơn (5 lần sai/30 phút); Apps Script không đọc được IP khách.
