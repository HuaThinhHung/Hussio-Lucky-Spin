import SectionHeading from "@/components/home/SectionHeading";

type TermsSectionProps = { terms: string[] };

export default function TermsSection({ terms }: TermsSectionProps) {
  return (
    <section id="the-le" aria-labelledby="terms-title" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <SectionHeading id="terms-title" eyebrow="ĐIỀU KHOẢN" title="THỂ LỆ CHƯƠNG TRÌNH" />
      <ul className="mt-10 space-y-4 rounded-2xl border border-gold/20 bg-navy/50 p-6 sm:p-8">
        {terms.map((term, index) => (
          <li key={index} className="flex gap-4 text-sm leading-relaxed text-ivory/80 sm:text-[15px]">
            <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rotate-45 bg-gold" />
            <span>{term}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
