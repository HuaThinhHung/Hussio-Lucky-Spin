"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import SpinExperience from "./SpinExperience";
import { loadCatalog, readLaunchParams } from "./api";
import type { EntryPhase } from "./CodeEntryCard";
import { DEFAULT_TOP_SIZES, FALLBACK_GIFTS, sizeCounts, sortSizes, toSegments } from "@/lib/gift-wheel";
import type { CatalogGift } from "@/lib/lucky-types";

type Catalog = { gifts: CatalogGift[]; open: boolean; live: boolean; contactUrl: string };

/**
 * Website wheel: gifts and in-stock sizes come live from the Sheet. Picking a
 * size lights the gifts that fit and darkens the rest; the server re-checks
 * stock when spinning, so the lit state is only a guide.
 */
export default function SizeFilteredSpin({ shopUrl }: { shopUrl: string }) {
  const [catalog, setCatalog] = useState<Catalog>({ gifts: FALLBACK_GIFTS, open: false, live: false, contactUrl: "" });
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<EntryPhase["name"]>("entry");
  const [top, setTop] = useState("");
  const [pants, setPants] = useState("");
  const [initialOrder, setInitialOrder] = useState("");

  const refresh = useCallback(() => {
    loadCatalog().then((response) => {
      setLoading(false);
      if (!response.ok) return;
      // Drop a picked size that has just sold out, so the next spin cannot fail on it again.
      if (response.gifts.length) {
        const top = sizeCounts(response.gifts, "top"), pants = sizeCounts(response.gifts, "pants");
        setTop((size) => (size && !top.has(size) ? "" : size));
        setPants((size) => (size && !pants.has(size) ? "" : size));
      }
      setCatalog((current) => ({
        gifts: response.gifts.length ? response.gifts : current.gifts,
        open: response.open,
        live: response.gifts.length > 0,
        contactUrl: response.contactUrl,
      }));
    });
  }, []);

  useEffect(() => {
    refresh();
    readLaunchParams().then((params) => setInitialOrder((params.order ?? params.don ?? "").trim().replace(/^#?/, "#").replace(/^#$/, "")));
  }, [refresh]);

  const sizes = useMemo(() => ({ top, pants }), [top, pants]);
  const segments = useMemo(() => toSegments(catalog.gifts, sizes), [catalog.gifts, sizes]);
  const topCounts = useMemo(() => sizeCounts(catalog.gifts, "top"), [catalog.gifts]);
  const pantsCounts = useMemo(() => sizeCounts(catalog.gifts, "pants"), [catalog.gifts]);
  const hasTop = catalog.gifts.some((gift) => gift.group === "top");
  // A top size is required only while some top still has stock; otherwise size-free gifts remain.
  const topInStock = catalog.gifts.some((gift) => gift.group === "top" && gift.available);
  const hasPants = catalog.gifts.some((gift) => gift.group === "pants");
  const lit = segments.filter((segment) => !segment.disabled).length;
  const locked = phase === "spinning" || phase === "done";

  const groups = [
    { key: "top", label: "Size áo / polo / áo khoác / sơ mi", value: top, set: setTop, counts: topCounts,
      options: sortSizes([...DEFAULT_TOP_SIZES, ...topCounts.keys()]), show: hasTop },
    { key: "pants", label: "Size quần", value: pants, set: setPants, counts: pantsCounts,
      options: sortSizes([...pantsCounts.keys()]), show: hasPants },
  ];

  const controls = (
    <section id="size-picker" className="size-selection" aria-label="Chọn size trước khi quay">
      <p className="info-index">01 · CHỌN SIZE TRƯỚC KHI QUAY</p>
      <div className="size-groups">
        {groups.filter((group) => group.show).map((group) => (
          <fieldset key={group.key} disabled={locked}>
            <legend>{group.label}</legend>
            <div>
              {group.options.map((size) => {
                const count = group.counts.get(size) ?? 0;
                // Only the live Sheet knows real stock; the offline snapshot never blocks a size.
                const soldOut = catalog.live && count === 0;
                return (
                  <button key={size} type="button" aria-pressed={group.value === size} disabled={soldOut}
                    title={soldOut ? `Size ${size} đã hết quà` : `${count} món quà có size ${size}`}
                    onClick={() => group.set(group.value === size ? "" : size)}>
                    <span>{size}</span>
                    {catalog.live ? <small>{soldOut ? "hết" : `${count} món`}</small> : null}
                  </button>
                );
              })}
            </div>
            {!group.options.length ? <small>Chưa có size quần trong quỹ quà.</small> : null}
          </fieldset>
        ))}
      </div>
      <p aria-live="polite" className="size-summary">
        {top || pants
          ? <><strong>{lit}</strong> / {segments.length} ô sáng: món còn quà đúng size của bạn và quà không cần size.</>
          : "Chọn size để làm sáng các món còn quà đúng size. Người quay sớm có nhiều lựa chọn size hơn."}
      </p>
      {locked ? <small>Size đã được chốt cho lượt quay này.</small> : null}
    </section>
  );

  return (
    <>
      {!loading && !catalog.open ? (
        <p className="campaign-closed" role="status">
          {catalog.live ? "Chương trình hiện chưa mở quay. Vui lòng quay lại sau." : "Bản xem trước — chưa kết nối hệ thống quay."}
        </p>
      ) : null}
      <SpinExperience
        segments={segments}
        shopUrl={shopUrl}
        sizeControls={controls}
        selectedSizes={sizes}
        requireTopSize={topInStock}
        contactUrl={catalog.contactUrl}
        initialOrder={initialOrder}
        onPhaseChange={setPhase}
        onStockChanged={refresh}
      />
    </>
  );
}
