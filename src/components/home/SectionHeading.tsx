import { cn } from "@/lib/cn";

type SectionHeadingProps = {
  id: string;
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
};

export default function SectionHeading({ id, eyebrow, title, description, className }: SectionHeadingProps) {
  return (
    <div className={cn("mx-auto max-w-2xl text-center", className)}>
      {eyebrow ? <p className="text-[11px] font-semibold tracking-[0.35em] text-gold">{eyebrow}</p> : null}
      <h2 id={id} className="mt-3 font-display text-3xl font-semibold tracking-tight text-ivory sm:text-4xl">
        {title}
      </h2>
      <div className="gold-rule mx-auto mt-5 w-24" />
      {description ? <p className="mt-5 text-sm leading-relaxed text-ivory/70 sm:text-base">{description}</p> : null}
    </div>
  );
}
