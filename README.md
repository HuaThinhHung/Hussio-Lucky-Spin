# HUSSIO Lucky Spin

Website vòng quay độc lập cho đơn website từ 1.300.000đ. Code quản lý trong GitHub; giao diện có thể đưa lên Cloudflare Pages, không cần đặt trong theme Shopify.

## Chạy và build

```sh
npm ci
npm run dev
npm run build:site
```

`build:site` tạo thư mục `dist` gồm trang HTML tự chứa font, logo, JavaScript và CSS. Không có backend/database trong thư mục xuất bản. Không cấu hình API thì trang chỉ xem trước, không trao quà thật.

## Cloudflare Pages kết nối GitHub

- Repository: HuaThinhHung/Hussio-Lucky-Spin
- Production branch: main
- Framework preset: None
- Build command: npm run build:site
- Output directory: dist
- Node.js: 22 hoặc mới hơn
- Biến build: NEXT_PUBLIC_SHEET_API_URL = link Apps Script /exec sau khi triển khai.

Gắn custom domain trong Cloudflare Pages sau khi build thành công. Mỗi lần push main, Pages build lại. Không đưa token Shopify, Client secret hoặc nội dung .env lên GitHub.

## Luồng khách hàng

Chọn tối đa 3 size mỗi nhóm → nhập mã đơn + SĐT/email → backend xác minh → quay → backend lưu quà, size, màu vào Google Sheet. Frontend chỉ chạy hoạt ảnh theo kết quả backend.

Google Sheet quản lý: WEB_GIFT_LIMITS (hạn mức, trọng số), WEB_GIFT_VARIANTS (size/SKU), WEB_RESULTS (kết quả), TON_QUA và TONG_QUAN (báo cáo). Các tab mã quay cũ đã lưu trữ.

## Tỷ lệ quay

Trọng số nằm tại WEB_GIFT_LIMITS, không nằm trong mã trình duyệt. Trong các món còn hàng đúng size, xác suất của một món = trọng số món đó / tổng trọng số các món hợp lệ. Ví dụ trọng số 1, 2, 7 tương ứng 10%, 20%, 70% khi cả ba món đều hợp lệ. Hết hàng hoặc đổi size thì tỷ lệ được tính lại. Trọng số trống là 1; 0 hoặc giá trị không hợp lệ thì loại khỏi lượt bốc. Mỗi ô trên hình vòng quay không biểu thị xác suất bằng nhau.

Không tự bật hoặc tăng quỹ quà bán hàng. Kho cần xác nhận hạn mức và size thực tế trước khi mở chương trình.

## Backend và triển khai thật

Xem [hướng dẫn triển khai](docs/WEBSITE_DEPLOYMENT.md). Apps Script kiểm tra đơn Shopify và chốt kết quả dưới khóa chống quay trùng. App Shopify chỉ là kết nối API phía sau, không phải nơi chứa giao diện/code website.

Các route /admin và /api cũ bị chặn trong bản Next.js. Mã Prisma cũ được giữ để tra cứu, không được đưa vào bản static.

## Kiểm tra

```sh
npm run typecheck
npm run lint
npm test
node scripts/test-website-orders.mjs
npm run build:site
```

Backend test dùng Sheet/Shopify giả lập. Chưa có kiểm thử đơn thật hoặc triển khai API thành công thì chưa được coi là sẵn sàng trao quà.
