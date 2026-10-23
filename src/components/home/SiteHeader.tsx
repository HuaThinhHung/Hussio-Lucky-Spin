import HussioLogo from "@/components/brand/HussioLogo";
import TrackedShopLink from "@/components/home/TrackedShopLink";

const NAV_LINKS = [
  { href: "#the-le", label: "THỂ LỆ" },
  { href: "#qua-tang", label: "QUÀ TẶNG" },
  { href: "#nguoi-may-man", label: "NGƯỜI MAY MẮN" },
] as const;

type SiteHeaderProps = { shopUrl: string };

export default function SiteHeader({ shopUrl }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-gold/15 bg-navy-dark/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="#top" aria-label="HUSSIO Lucky Spin — về đầu trang" className="shrink-0">
          <HussioLogo />
        </a>

        <nav aria-label="Điều hướng chính" className="hidden md:block">
          <ul className="flex items-center gap-8 text-xs font-medium tracking-[0.2em] text-ivory/80">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="transition-colors hover:text-gold-light">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <TrackedShopLink
          href={shopUrl}
          placement="header"
          className="inline-flex h-10 items-center rounded-full border border-gold/70 px-5 text-xs font-semibold tracking-[0.2em] text-gold-light transition hover:bg-gold hover:text-navy-dark"
        >
          MUA SẮM
        </TrackedShopLink>
      </div>

      {/* Mobile: compact anchor row */}
      <nav aria-label="Điều hướng nhanh" className="border-t border-gold/10 md:hidden">
        <ul className="mx-auto flex max-w-6xl justify-center gap-6 px-4 py-2 text-[11px] font-medium tracking-[0.18em] text-ivory/75">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="hover:text-gold-light">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
