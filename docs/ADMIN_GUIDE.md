# Hướng dẫn vận hành Admin — HUSSIO Lucky Spin

URL: `https://quay.hussio-vn.com/admin`

## Quyền

| Quyền | Được làm |
|---|---|
| **STAFF** (nhân viên FB / cửa hàng / kho) | Tạo mã, import CSV, xem/huỷ/duyệt/mở khoá mã, đánh dấu CONFIRMED / FULFILLED, xem voucher, analytics |
| **ADMIN** | Toàn bộ + chỉnh chương trình, giải thưởng & tỷ lệ, kho quà, VOID phần thưởng, đồng bộ Shopify, quản lý tài khoản |

Tạo tài khoản: **Cài đặt → Tài khoản quản trị** (hoặc `npm run admin:create -- email "Tên" STAFF`).
Đăng nhập sai 8 lần / 15 phút sẽ bị chặn tạm thời. Phiên đăng nhập hết hạn sau 12 giờ.

## Phát mã cho đơn Facebook / Cửa hàng

1. **Tạo mã quay** → nhập Tên, SĐT, Mã đơn/bill, Giá trị đơn, Kênh (+ Tỉnh/TP để hiện ở "Người may mắn").
2. Bấm **TẠO MÃ QUAY**. Đơn < 1.300.000đ hoặc trùng mã đơn sẽ bị từ chối (hiện mã đã cấp trước đó).
3. **SAO CHÉP CODE** hoặc **GỬI CHO KHÁCH (copy tin nhắn)** → dán vào Messenger/Zalo. Tại cửa hàng: đưa mã + QR cho khách.

Nhiều đơn một lúc: **Import CSV** với cột `customer_name, phone, order_reference, order_value, channel` (tuỳ chọn `city`). Kênh nhận `FACEBOOK`, `STORE`, `SHOPIFY_WEB` (hoặc "fb", "cửa hàng", "website"). Kết quả từng dòng hiển thị ngay, copy được danh sách mã đã tạo.

## Trao quà

- **Người trúng → lọc "Quà sản phẩm"**: thấy khách, kênh, mã đơn, quà cụ thể (SKU/size nếu có), size khách chọn, ghi chú.
- Liên hệ khách → **MARK CONFIRMED** → giao quà → **MARK FULFILLED**.
- Đơn huỷ / gian lận → **VOID REWARD** (ADMIN): quà trả về kho, voucher bị vô hiệu. Không VOID được quà đã giao hoặc voucher đã dùng.

## Giải thưởng & tỷ lệ (ADMIN)

- Tỷ lệ = trọng số / tổng trọng số **các giải còn quà**. Mặc định 85% voucher/freeship, 15% quà sản phẩm.
- **Thứ tự** = vị trí ô trên vòng quay. **Chữ lớn / chữ nhỏ** = nội dung trên ô.
- **Quota** giới hạn số lần trúng 1 giải (trống = không giới hạn). Giải hết quota hoặc hết kho tự loại khỏi lượt quay.
- Tắt "Hiển thị" để gỡ giải khỏi vòng quay.

## Kho quà tặng (ADMIN)

- Mỗi nhóm (Polo, Áo thun, Sơ mi, Áo khoác, Quần dài) gồm các dòng sản phẩm: tên, size, màu, SKU, số lượng, giá vốn.
- Seed ban đầu từ Gift Sheet: 172 sản phẩm theo nhóm (chưa có size). Khi có danh sách size thật → **Import CSV** (`category,product_name,size,color,sku,quantity,cost`) rồi tắt dòng tổng cũ. Có size → khách chỉ chọn được size còn hàng.
- Kho tự trừ khi khách trúng, tự cộng lại khi VOID.

## Chương trình (ADMIN)

- **Trạng thái**: DRAFT (chuẩn bị) → ACTIVE (đang chạy) → PAUSED (tạm dừng) / ENDED.
- **Bắt đầu / Kết thúc quay**, **Hạn chót đặt đơn** (đơn Website sau mốc này không được cấp mã).
- **Đơn COD**, **hiển thị tên người trúng** (MASKED / FIRST_NAME / FULL_NAME_WITH_CONSENT), **thời hạn & cộng dồn voucher**, **thể lệ** (mỗi dòng một điều) — sửa trực tiếp, không cần sửa code.

## Hỗ trợ khách

- Khách quên kết quả → tự nhập lại mã + SĐT trên trang quay để xem **BẠN ĐÃ QUAY MÃ NÀY**.
- Mã bị khoá do nhập sai SĐT 5 lần → **Mã quay → Mở khoá**.
- Số điện thoại không lưu dạng đọc được (chỉ 3 số cuối để đối chiếu).
