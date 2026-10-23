import SectionHeading from "@/components/home/SectionHeading";
import { BRAND } from "@/lib/constants";
import { formatVnd } from "@/lib/format";

type HowItWorksProps = { minimumOrderValue: number };

export default function HowItWorks({ minimumOrderValue }: HowItWorksProps) {
  const steps = [
    {
      number: "01",
      title: "MUA HÀNG",
      body: `Mua đơn từ ${formatVnd(minimumOrderValue)} tại Website, Facebook hoặc Cửa hàng HUSSIO.`,
    },
    { number: "02", title: "NHẬN MÃ", body: "Nhận mã HUSSIO Lucky Spin từ HUSSIO." },
    {
      number: "03",
      title: "QUAY & NHẬN QUÀ",
      body: `Truy cập ${BRAND.siteHost}, nhập mã và quay thưởng.`,
    },
  ];

  return (
    <section aria-labelledby="how-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <SectionHeading id="how-title" eyebrow="3 BƯỚC ĐƠN GIẢN" title="CÁCH THAM GIA" />
      <ol className="mt-12 grid gap-4 sm:grid-cols-3 sm:gap-6">
        {steps.map((step) => (
          <li
            key={step.number}
            className="relative rounded-2xl border border-gold/20 bg-navy/60 p-6 sm:p-8"
          >
            <span className="font-display text-5xl font-semibold italic text-gold-gradient">{step.number}</span>
            <h3 className="mt-4 text-sm font-semibold tracking-[0.22em] text-ivory">{step.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-ivory/70">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
