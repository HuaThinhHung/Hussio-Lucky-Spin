# HUSSIO Lucky Spin — Nội dung truyền thông

Bộ nội dung dùng cho Facebook, Website, Cửa hàng và CSKH. Tất cả trỏ về **https://quay.hussio-vn.com**.

---

## 1. Bài đăng Facebook

> 🎁 **HUSSIO LUCKY SPIN — QUAY LÀ CÓ QUÀ**
>
> Black Friday này, mua sắm càng chất — quà càng bất ngờ.
>
> Với mỗi đơn HUSSIO từ 1.300.000đ tại Website, Facebook hoặc Cửa hàng, bạn sẽ nhận ngay 01 mã Lucky Spin.
>
> Truy cập:
> quay.hussio-vn.com
>
> Nhập mã — quay ngay — nhận quà.
>
> 🎁 Voucher HUSSIO
> 🎁 Freeship
> 🎁 Polo
> 🎁 Sơ mi
> 🎁 Áo thun
> 🎁 Áo khoác
> 🎁 Và nhiều quà HUSSIO khác
>
> 100% mã hợp lệ đều có quà.
>
> Số lượng quà có hạn.
>
> #HUSSIO
> #BlackFriday2026
> #HussioLuckySpin

---

## 2. Thanh thông báo Website (promotion bar)

| Thiết bị | Nội dung |
|---|---|
| Desktop | 🎁 ĐƠN TỪ 1.300.000Đ — NHẬN MÃ LUCKY SPIN — 100% CÓ QUÀ → QUAY NGAY |
| Mobile | 🎁 ĐƠN 1.3TR → NHẬN MÃ QUAY → 100% CÓ QUÀ |
| CTA | QUAY NGAY → https://quay.hussio-vn.com |

Snippet Liquid sẵn sàng: [`shopify-theme/snippets/hussio-lucky-spin-bar.liquid`](../../shopify-theme/snippets/hussio-lucky-spin-bar.liquid) — chỉ cài vào **bản sao theme**, xem trước, publish khi đã duyệt.

---

## 3. Thông điệp giỏ hàng (giai đoạn sau MVP)

- Dưới 1.300.000đ: `Bạn còn {{amount}} để nhận 01 mã HUSSIO Lucky Spin 🎁`
- Đạt ngưỡng: `🎉 Bạn đã đủ điều kiện nhận 01 mã HUSSIO Lucky Spin sau khi hoàn tất đơn hàng.`

Snippet: [`shopify-theme/snippets/hussio-lucky-spin-cart-message.liquid`](../../shopify-theme/snippets/hussio-lucky-spin-cart-message.liquid) (tính theo tiền hàng sau giảm giá, không gồm ship — khớp logic backend).

---

## 4. Standee / QR tại cửa hàng

```
QUÉT MÃ & QUAY QUÀ HUSSIO

Mua đơn từ 1.300.000đ
Nhận 01 mã Lucky Spin
100% CÓ QUÀ

[QR] quay.hussio-vn.com
```

File QR (nền trắng, mã navy, mức sửa lỗi H — in tốt khổ A5/A4):
- [`qr-quay-hussio-vn.svg`](qr-quay-hussio-vn.svg) — dùng cho thiết kế in
- `qr-quay-hussio-vn.png` (1200px) — tạo bằng `npm run qr`

---

## 5. Kịch bản CSKH Facebook / Zalo

Nút **"GỬI CHO KHÁCH (copy tin nhắn)"** trong Admin → Tạo mã quay tự điền mã vào mẫu này:

```
Cảm ơn bạn đã mua sắm tại HUSSIO 🎁

Đơn hàng của bạn đã đủ điều kiện tham gia HUSSIO Lucky Spin.

Mã quay của bạn:
{{LUCKY_CODE}}

Truy cập:
https://quay.hussio-vn.com

Nhập mã cùng số điện thoại mua hàng để quay và nhận quà.

Mỗi mã chỉ được sử dụng 01 lần.

Chúc bạn may mắn! ✨
```

### Câu trả lời mẫu cho tình huống thường gặp

| Khách hỏi | Trả lời |
|---|---|
| "Nhập mã báo sai số điện thoại" | Bạn nhập đúng SĐT đã dùng khi mua hàng giúp HUSSIO nhé (có thể có hoặc không số 0 đầu đều được). Nếu vẫn lỗi, gửi mã cho HUSSIO kiểm tra. |
| "Mã bị tạm khoá" | Mã khoá 30 phút sau 5 lần nhập sai SĐT. Nhân viên có thể mở khoá trong Admin → Mã quay → **Mở khoá**. |
| "Quay rồi mà quên mã voucher" | Vào lại quay.hussio-vn.com, nhập mã + SĐT → hệ thống hiện **BẠN ĐÃ QUAY MÃ NÀY** kèm mã voucher. |
| "Trúng áo thì nhận thế nào?" | HUSSIO sẽ liên hệ xác nhận mẫu, màu, size theo tồn kho quà tặng và gửi quà (hoặc nhận tại cửa hàng). |
| "Voucher dùng cho đơn này được không?" | Voucher Lucky Spin dành cho **đơn hàng tiếp theo** tại hussio.com, theo điều kiện ghi trên voucher. |
