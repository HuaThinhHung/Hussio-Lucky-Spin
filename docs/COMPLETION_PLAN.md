# Kế hoạch hoàn thiện — 26/10/2026

Đích: quay.hussio-vn.com; GitHub quản lý code; giao diện độc lập Shopify.

| Phần | Trạng thái | Điều kiện hoàn tất |
|---|---|---|
| UI/chọn size | Đã sửa và kiểm tra Chrome | Vòng quay lớn, toàn màn hình, lọc đúng size |
| Danh mục | Đã đọc đủ 6 tab kho | Chốt giữ 46 mẫu hay thay bằng danh mục kho; mới khớp 1 mẫu |
| Quỹ quà | Chưa mở | SKU/size, hạn mức dành riêng, trọng số được xác nhận |
| Backend | 25 kiểm tra giả lập đạt | Triển khai API, xác minh Shopify, lưu và trừ kho thực tế |
| Code | 72 kiểm thử đạt | Build/lint/typecheck đạt |
| Hosting | Đã push GitHub | Cấp quyền Cloudflare riêng repository và build tự động |
| Domain | Đã chốt, chưa gắn | HTTPS quay.hussio-vn.com hoạt động |
| Mở chương trình | Chưa thực hiện | Chốt thời gian, kiểm thử đầu cuối với đơn được chỉ định |

Thứ tự: chốt danh mục → nạp SKU/size → backend → hosting/domain → kiểm thử đầu cuối → mở chương trình.
Không lấy toàn bộ tồn bán hàng làm hạn mức phát quà. Xem SIZE_RECONCILIATION.md cho kết quả đối chiếu.
Quyền Cloudflare/GitHub và Shopify vẫn cần xác nhận tại bước cấp quyền theo chính sách trình duyệt.
