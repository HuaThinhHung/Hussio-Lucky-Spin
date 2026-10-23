"use client";

import { useCallback, useEffect, useState } from "react";
import SectionHeading from "@/components/home/SectionHeading";
import { WINNER_EVENT } from "@/components/spin/api";
import { formatRelativeTime } from "@/lib/format";
import type { PublicWinner } from "@/lib/lucky-types";

const REFRESH_INTERVAL_MS = 60_000;

type RecentWinnersProps = {
  initialWinners: PublicWinner[];
  /** Server render time, so relative times match during hydration. */
  serverNow: string;
};

export default function RecentWinners({ initialWinners, serverNow }: RecentWinnersProps) {
  const [winners, setWinners] = useState(initialWinners);
  const [now, setNow] = useState(() => new Date(serverNow));

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/winners", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { winners: PublicWinner[] };
      setWinners(data.winners);
      setNow(new Date());
    } catch {
      // keep the current list on network errors
    }
  }, []);

  useEffect(() => {
    const tick = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_INTERVAL_MS);
    const onWinner = () => void refresh();
    window.addEventListener(WINNER_EVENT, onWinner);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener(WINNER_EVENT, onWinner);
    };
  }, [refresh]);

  return (
    <section id="nguoi-may-man" aria-labelledby="winners-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <SectionHeading id="winners-title" eyebrow="CẬP NHẬT LIÊN TỤC" title="NGƯỜI MAY MẮN GẦN ĐÂY" />

      {winners.length === 0 ? (
        <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-dashed border-gold/30 bg-navy/40 p-8 text-center">
          <p className="text-sm leading-relaxed text-ivory/80 sm:text-base">
            Những chủ nhân may mắn đầu tiên đang chờ xuất hiện.
          </p>
          <a
            href="#quay"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-gold px-8 text-xs font-semibold tracking-[0.2em] text-navy-dark transition hover:bg-gold-light"
          >
            NHẬP MÃ &amp; QUAY NGAY
          </a>
        </div>
      ) : (
        <ul
          aria-live="polite"
          className="no-scrollbar -mx-4 mt-10 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4"
        >
          {winners.map((winner) => (
            <li
              key={winner.id}
              className="w-[72%] shrink-0 snap-start rounded-xl border border-gold/20 bg-navy/60 p-5 sm:w-auto"
            >
              <p className="font-display text-lg font-semibold text-ivory">{winner.displayName}</p>
              <p className="mt-1 text-xs text-ivory/55">{winner.city ?? "Việt Nam"}</p>
              <p className="mt-4 text-sm font-semibold text-gold-light">{winner.prizeName}</p>
              <p className="mt-1 text-xs text-ivory/50">
                <time dateTime={winner.createdAt}>{formatRelativeTime(winner.createdAt, now)}</time>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
