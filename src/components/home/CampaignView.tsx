import SpinExperience from "@/components/spin/SpinExperience";
import ThemeShell from "@/components/home/ThemeShell";
import { DEFAULT_SHOP_URL } from "@/lib/constants";
import { SHEET_SEGMENTS } from "@/lib/sheet-campaign";

export default function CampaignView({ available = false }: { available?: boolean }) {
  const shopUrl = DEFAULT_SHOP_URL;
  const initialTheme = "light" as const;
  return <ThemeShell initialTheme={initialTheme} shopUrl={shopUrl}>
    <main>
      <section className="campaign-heading">
        <div className="campaign-kicker"><span /> A LITTLE LUCK. A LOT OF STYLE.</div>
        <div className="campaign-title-row"><h1>BLACK<span>FRIDAY.</span></h1><div className="campaign-offer"><p>MUA SẮM ĐỦ</p><strong>1.300.000<span>Đ</span></strong><p>NHẬN 01 LƯỢT QUAY QUÀ</p></div></div>
        <div className="campaign-baseline"><span>01 MÃ · 01 LƯỢT QUAY</span><span>BLACK FRIDAY 2026</span></div>
        {!available && <p className="mt-4 text-sm text-gold">Chương trình hiện chưa mở quay.</p>}
      </section>
      <SpinExperience segments={SHEET_SEGMENTS} shopUrl={shopUrl} />
      <div className="footer-wordmark" aria-hidden="true">HUSSIO</div>
      <section className="campaign-info" aria-label="Hướng dẫn tham gia">
        <div><span className="info-index">01 / MUA SẮM</span><h2>Chọn phong cách của bạn.</h2><p>Đơn hàng từ 1.300.000đ nhận 01 mã quay từ HUSSIO.</p></div>
        <div><span className="info-index">02 / QUAY QUÀ</span><h2>Nhập mã. Chạm may mắn.</h2><p>Sử dụng mã được cấp để mở lượt quay. Mỗi mã dùng một lần.</p></div>
        <div><span className="info-index">03 / NHẬN QUÀ</span><h2>Món quà dành cho bạn.</h2><p>Giữ mã và kết quả, liên hệ nhân viên để xác nhận nhận quà.</p></div>
      </section>
      <section className="campaign-bottom">
        <div><span className="info-index">HUSSIO STORE</span><p>240 Quang Trung, Gò Vấp, TP.HCM</p><a href={shopUrl}>Khám phá HUSSIO ↗</a></div>
        <details><summary>Thể lệ & thông tin nhận quà <span>+</span></summary><p>Đơn hàng từ 1.300.000đ được cấp 01 mã quay sau khi nhân viên xác nhận đủ điều kiện. Mã chỉ sử dụng một lần, không cần nhập số điện thoại. Quà tặng theo số lượng thực tế. Voucher áp dụng theo điều kiện hiển thị tại kết quả. Nhận quà online hoặc tại cửa hàng sau khi đối chiếu mã và đơn hàng.</p></details>
      </section>
    </main>
    <footer className="campaign-footer"><span>© 2026 HUSSIO</span><span>BLACK FRIDAY / LUCKY SPIN</span></footer>
  </ThemeShell>;
}
