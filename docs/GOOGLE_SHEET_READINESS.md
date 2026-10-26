# Trạng thái Google Sheet

> LƯU TRỮ: nội dung bên dưới thuộc luồng 500 mã cũ. Luồng hiện hành dùng mã đơn website + SĐT/email. Xem WEBSITE_DEPLOYMENT.md, COMPLETION_PLAN.md và SIZE_RECONCILIATION.md. Ngày 26/10/2026: 25 kiểm thử backend giả lập đạt; API thật chưa triển khai; quỹ quà chưa mở.

Đã tạo 500 mã duy nhất trên Sheet. Chưa triển khai Apps Script; chưa kiểm thử trực tiếp luồng cấp/quay/trao quà.

## Ưu tiên trước khi mở bán
1. Cài Apps Script gắn với Sheet, triển khai web app và kiểm tra quyền chủ sở hữu. Trình duyệt Codex hiện bị chặn docs.google.com.
2. Xác nhận số lượng thực tế cho 8 quà, ngày bắt đầu và kết thúc. Hiện PAUSED, số lượng 0.
3. Kiểm tra chia sẻ Sheet chỉ cho chủ cửa hàng và CS, không công khai mã.
4. Kiểm thử hai yêu cầu quay cùng mã, thử lại sau mất mạng, hết quà, mã chưa cấp, hết hạn, hủy và trao quà hai lần.
5. Không cấp mã nhiều hơn số quà còn lại trừ các mã ACTIVE còn hạn. Đã bổ sung kiểm tra này trong Code.gs; chưa triển khai.
6. CS không sửa trực tiếp cột trạng thái/kết quả. ScriptLock chỉ bảo vệ các thao tác qua script, không khóa thao tác tay trên Sheet.
7. Voucher hiện xử lý thủ công bởi CS; chưa tích hợp checkout.

## Vận hành
Menu HUSSIO: Cấp mã → Tra cứu → Xác nhận đã trao quà. Menu chỉ xuất hiện sau khi cài script và tải lại Sheet.
Mỗi mã lưu kết quả trong một dòng; tồn quà được tính từ lịch sử để tránh lệch do ghi hai nơi.
