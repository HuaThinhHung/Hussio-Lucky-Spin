import HussioLogo from "@/components/brand/HussioLogo";
import TrackedShopLink from "@/components/home/TrackedShopLink";

type SiteFooterProps = { shopUrl: string };

export default function SiteFooter({ shopUrl }: SiteFooterProps) {
  const shopHost = shopUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <footer className="border-t border-gold/15 bg-navy-dark">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 text-center sm:px-6">
        <HussioLogo />
        <TrackedShopLink
          href={shopUrl}
          placement="footer"
          className="text-xs font-semibold tracking-[0.25em] text-gold-light hover:text-gold"
        >
          MUA SẮM TẠI HUSSIO
        </TrackedShopLink>
        <a href={shopUrl} className="text-sm text-ivory/60 hover:text-ivory" target="_blank" rel="noopener">
          {shopHost}
        </a>
        <p className="text-xs text-ivory/40">© 2026 HUSSIO. HUSSIO Lucky Spin — Black Friday 2026.</p>
      </div>
    </footer>
  );
}
