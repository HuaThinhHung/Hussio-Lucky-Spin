import SizeFilteredSpin from "@/components/spin/SizeFilteredSpin";
import ThemeShell from "@/components/home/ThemeShell";
import { DEFAULT_SHOP_URL } from "@/lib/constants";


export default function CampaignView() {
  const shopUrl = DEFAULT_SHOP_URL;
  const initialTheme = "light" as const;
  return <ThemeShell initialTheme={initialTheme} shopUrl={shopUrl}>
    <main>
      <section className="campaign-heading">
        <div className="campaign-kicker"><span /> A LITTLE LUCK. A LOT OF STYLE.</div>
        <div className="campaign-title-row"><h1>BLACK<span>FRIDAY.</span></h1><div className="campaign-offer"><p>MUA SẮM ĐỦ</p><strong>1.300.000<span>Đ</span></strong><p>NHẬN 01 LƯỢT QUAY QUÀ</p></div></div>
        <div className="campaign-baseline"><span>01 MÃ · 01 LƯỢT QUAY</span><span>BLACK FRIDAY 2026</span></div>
      </section>
      <SizeFilteredSpin shopUrl={shopUrl} />
      <div className="footer-wordmark" aria-hidden="true">HUSSIO</div>
      <section className="campaign-info" aria-label="Hướng dẫn tham gia">
        <div><span className="info-index">01 / MUA SẮM</span><h2>Chọn phong cách của bạn.</h2><p>Đơn website từ 1.300.000đ đủ điều kiện nhận 01 lượt quay.</p></div>
        <div><span className="info-index">02 / QUAY QUÀ</span><h2>Chọn size. Xác minh đơn.</h2><p>Chọn size áo/quần, nhập mã đơn và SĐT/email đặt hàng. Mỗi đơn chỉ quay một lần.</p></div>
        <div><span className="info-index">03 / NHẬN QUÀ</span><h2>Quà gửi kèm đơn hàng.</h2><p>Quà, size và màu được ghi theo đơn; HUSSIO đóng gói gửi kèm. Mở lại trang bất cứ lúc nào để xem kết quả.</p></div>
      </section>
      <section className="campaign-bottom">
        <div><span className="info-index">HUSSIO STORE</span><p>240 Quang Trung, Gò Vấp, TP.HCM</p><a href={shopUrl}>Khám phá HUSSIO ↗</a></div>
        <details><summary>Thể lệ & thông tin nhận quà <span>+</span></summary><p>Áp dụng riêng cho đơn mua trên website trong thời gian chương trình, đã thanh toán và chưa giao hàng, có giá trị tiền hàng sau giảm từ 1.300.000đ (áp dụng cả đơn COD). Nhập mã đơn cùng số điện thoại hoặc email đặt hàng để xác minh. Mỗi đơn nhận 01 lượt quay. Chọn size trước khi quay; quà được phân bổ theo size và số lượng còn lại — quay sớm có nhiều lựa chọn size hơn. Kết quả được lưu theo đơn và quà được đóng gói gửi kèm; nếu đơn đã giao trước lúc quay, HUSSIO sẽ liên hệ gửi quà riêng. Đơn huỷ hoặc hoàn tiền không còn hiệu lực nhận quà.</p></details>
      </section>
    </main>
    <footer className="campaign-footer"><span>© 2026 HUSSIO</span><span>BLACK FRIDAY / LUCKY SPIN</span></footer>
  </ThemeShell>;
}
