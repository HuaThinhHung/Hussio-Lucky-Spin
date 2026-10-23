# Quản lý mã gọn

Mở /admin, đăng nhập bằng tài khoản cửa hàng đang có. Khách không được truy cập danh sách mã.

1. Nút “Tạo đủ 500 mã” bổ sung lô lên 500, bấm lại không tạo thêm lô. Mã mới CHƯA CẤP, không thể quay.
2. Tìm một mã chưa cấp, nhập mã đơn hàng và bấm “Cấp mã”. Sao chép mã gửi khách. Một mã đơn cửa hàng chỉ được cấp một mã trong chương trình.
3. Khách nhập mã, kiểm tra, rồi quay. Không cần số điện thoại. Người giữ mã có thể sử dụng mã: chỉ gửi riêng cho khách.
4. Kết quả và trạng thái USED được lưu cùng giao dịch. Mã chỉ quay một lần; thử lại sẽ xem kết quả đã lưu. Bảng cập nhật mỗi 3 giây (không phải websocket).
5. Nhân viên đối chiếu mã, đơn hàng và quà trúng để trao quà. Không cần tự tick đã quay.

Giữ cơ sở dữ liệu PostgreSQL và thông tin đăng nhập trên máy chủ. Không đưa danh sách mã lên trang công khai.

## Chuẩn bị dữ liệu trên môi trường mới

Sau khi seed chương trình, chạy:

```
npx tsx --conditions=react-server scripts/add-simple-prizes.ts
npx tsx --conditions=react-server scripts/prepare-codes.ts
```

Hai lệnh có thể chạy lại. Giữ các giải cũ, bổ sung vớ/mũ/thắt lưng và mức giảm còn thiếu trong 10K–50K. Phụ kiện tạm đặt 50 phần mỗi loại, trọng số 5 mỗi loại; voucher bổ sung trọng số 10. Cần chỉnh theo tồn thực tế trước khi phát mã. Ô bằng nhau không có nghĩa xác suất bằng nhau; xác suất theo trọng số và tồn còn lại. Cấu hình nâng cao vẫn có tại /admin/prizes và /admin/campaign nhưng đã bỏ menu rườm rà.

Chưa tích hợp Google Sheet. Dữ liệu local không tự chuyển lên website đã triển khai. Script không đổi lịch/mở chiến dịch. Voucher mua sắm trực tuyến vẫn cần kết nối Shopify đang có; nếu chưa cấu hình, nhân viên xử lý voucher tại cửa hàng.
