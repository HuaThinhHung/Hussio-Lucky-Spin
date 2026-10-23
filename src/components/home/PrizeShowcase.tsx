import SectionHeading from "@/components/home/SectionHeading";
import { cn } from "@/lib/cn";
import type { PrizeShowcaseItem } from "@/lib/lucky-types";

type PrizeShowcaseProps = { prizes: PrizeShowcaseItem[] };

export default function PrizeShowcase({ prizes }: PrizeShowcaseProps) {
  const vouchers = prizes.filter((prize) => prize.type !== "PRODUCT_POOL");
  const products = prizes.filter((prize) => prize.type === "PRODUCT_POOL");

  return (
    <section id="qua-tang" aria-labelledby="prizes-title" className="border-y border-gold/10 bg-navy/40">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeading
          id="prizes-title"
          eyebrow="QUÀ TẶNG"
          title="Quà từ HUSSIO"
          description="Voucher & freeship cho đơn hàng tiếp theo, cùng các sản phẩm HUSSIO từ quỹ quà Black Friday. Số lượng quà có hạn."
        />

        <div className="mt-12 grid gap-10 lg:grid-cols-2">
          <PrizeGroup
            title="SẢN PHẨM HUSSIO"
            note="Mẫu, màu và kích thước được HUSSIO xác nhận theo tồn kho quà tặng thực tế."
            prizes={products}
            showDescriptions={false}
          />
          <PrizeGroup
            title="VOUCHER & FREESHIP"
            note="Áp dụng cho đơn hàng tiếp theo tại hussio.com, mỗi mã dùng 01 lần."
            prizes={vouchers}
            showDescriptions
          />
        </div>
      </div>
    </section>
  );
}

type PrizeGroupProps = {
  title: string;
  note: string;
  prizes: PrizeShowcaseItem[];
  showDescriptions: boolean;
};

function PrizeGroup({ title, note, prizes, showDescriptions }: PrizeGroupProps) {
  if (prizes.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold tracking-[0.3em] text-gold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ivory/60">{note}</p>
      <ul className="mt-5 grid grid-cols-2 gap-3">
        {prizes.map((prize) => (
          <li
            key={prize.id}
            className={cn(
              "rounded-xl border p-4 transition sm:p-5",
              prize.available ? "border-gold/25 bg-navy-dark/60" : "border-ivory/10 bg-navy-dark/30 opacity-60",
            )}
          >
            <p className="font-display text-lg font-semibold leading-snug text-ivory sm:text-xl">{prize.name}</p>
            {showDescriptions ? <p className="mt-2 text-xs leading-relaxed text-ivory/60 sm:text-sm">{prize.description}</p> : null}
            {!prize.available ? (
              <span className="mt-2 inline-block rounded-full border border-ivory/20 px-2 py-0.5 text-[10px] tracking-widest text-ivory/70">
                ĐÃ HẾT
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
