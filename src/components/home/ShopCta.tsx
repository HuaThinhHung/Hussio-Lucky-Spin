import TrackedShopLink from "@/components/home/TrackedShopLink";
import { formatVnd } from "@/lib/format";

type ShopCtaProps = { shopUrl: string; minimumOrderValue: number };

export default function ShopCta({ shopUrl, minimumOrderValue }: ShopCtaProps) {
  return (
    <section aria-labelledby="shop-cta-title" className="px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-navy-soft via-navy to-navy-dark px-6 py-12 text-center sm:px-12 sm:py-16">
        <div aria-hidden="true" className="absolute -right-24 -top-24 size-64 rounded-full bg-gold/10 blur-3xl" />
        <p className="text-[11px] font-semibold tracking-[0.35em] text-gold">BLACK FRIDAY 2026</p>
        <h2 id="shop-cta-title" className="mt-4 font-display text-3xl font-semibold text-ivory sm:text-4xl">
          Thêm một đơn, thêm một lượt quay
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-ivory/75 sm:text-base">
          Mỗi đơn từ {formatVnd(minimumOrderValue)} tại Website, Facebook hoặc Cửa hàng HUSSIO đều nhận 01 mã Lucky Spin.
        </p>
        <TrackedShopLink
          href={shopUrl}
          placement="footer_cta"
          className="mt-8 inline-flex h-13 items-center justify-center rounded-full bg-gold px-10 text-sm font-semibold tracking-[0.2em] text-navy-dark transition hover:bg-gold-light"
        >
          MUA SẮM TẠI HUSSIO
        </TrackedShopLink>
      </div>
    </section>
  );
}
