import LightParticles from "@/components/home/LightParticles";
import TrackedShopLink from "@/components/home/TrackedShopLink";
import { BRAND } from "@/lib/constants";
import { formatVnd } from "@/lib/format";

type HeroProps = {
  shopUrl: string;
  minimumOrderValue: number;
  statusNote: string | null;
};

export default function Hero({ shopUrl, minimumOrderValue, statusNote }: HeroProps) {
  const minimum = formatVnd(minimumOrderValue).toLocaleUpperCase("vi");

  return (
    <section id="top" aria-labelledby="hero-title" className="relative overflow-hidden">
      <LightParticles />
      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 pb-14 pt-12 text-center sm:px-6 sm:pt-16 lg:pb-20">
        <p className="inline-flex items-center gap-2 rounded-full border border-gold/60 px-4 py-1.5 text-[11px] font-semibold tracking-[0.3em] text-gold-light">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-gold" />
          {BRAND.campaignBadge}
        </p>

        <h1 id="hero-title" className="mt-6 font-display text-[2.6rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
          <span className="block text-ivory">HUSSIO</span>
          <span className="block italic text-gold-gradient">LUCKY SPIN</span>
        </h1>
        <p className="mt-3 text-[11px] font-medium tracking-[0.35em] text-ivory/60 sm:text-xs">{BRAND.programSubtitle}</p>

        <div className="gold-rule mt-8 w-40" />

        <p className="mt-8 text-lg font-semibold tracking-[0.12em] text-ivory sm:text-2xl">
          MUA TỪ <span className="text-gold-light">{minimum}</span>
          <br />
          NHẬN 01 LƯỢT QUAY
        </p>

        <p className="mt-5 max-w-xl text-sm leading-relaxed text-ivory/75 sm:text-base">
          Mỗi đơn hàng HUSSIO từ {formatVnd(minimumOrderValue)} sẽ nhận một mã Lucky Spin. Nhập mã và thử vận may để
          nhận quà từ HUSSIO.
        </p>

        <p className="mt-7 inline-flex items-center gap-3 font-display text-2xl font-semibold text-gold-gradient sm:text-3xl">
          <span aria-hidden="true" className="h-px w-8 bg-gold/60" />
          100% CÓ QUÀ
          <span aria-hidden="true" className="h-px w-8 bg-gold/60" />
        </p>

        {statusNote ? (
          <p className="mt-5 rounded-full border border-ivory/15 bg-ivory/5 px-4 py-2 text-xs tracking-wide text-ivory/80">
            {statusNote}
          </p>
        ) : null}

        <div className="mt-9 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row sm:gap-4">
          <a
            href="#quay"
            className="inline-flex h-13 w-full items-center justify-center rounded-full bg-gold px-8 text-sm font-semibold tracking-[0.18em] text-navy-dark shadow-[0_10px_40px_-10px_rgba(199,161,90,0.7)] transition hover:bg-gold-light sm:w-auto"
          >
            NHẬP MÃ &amp; QUAY NGAY
          </a>
          <TrackedShopLink
            href={shopUrl}
            placement="hero"
            className="inline-flex h-13 w-full items-center justify-center rounded-full border border-ivory/30 px-8 text-sm font-semibold tracking-[0.18em] text-ivory transition hover:border-gold hover:text-gold-light sm:w-auto"
          >
            MUA SẮM TẠI HUSSIO
          </TrackedShopLink>
        </div>
      </div>
    </section>
  );
}
