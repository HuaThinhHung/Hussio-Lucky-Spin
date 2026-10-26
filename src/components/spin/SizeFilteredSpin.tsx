"use client";
import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import SpinExperience from "./SpinExperience";
import { loadCatalog, readLaunchParams } from "./api";
import type { EntryPhase } from "./CodeEntryCard";
import { DEFAULT_TOP_SIZES, FALLBACK_GIFTS, MAX_SIZES, fitsSizes, hasSizes, sizeCounts, sortSizes, toSegments, wheelLabel } from "@/lib/gift-wheel";
import type { CatalogGift } from "@/lib/lucky-types";

type Catalog = { gifts: CatalogGift[]; open: boolean; live: boolean; contactUrl: string };

/** Keeps the same array when nothing was removed, so an unchanged pick does not re-render. */
function keepInStock(sizes: string[], stock: Map<string, number>) {
  const kept = sizes.filter((size) => stock.has(size));
  return kept.length === sizes.length ? sizes : kept;
}

/**
 * Website wheel: gifts and in-stock sizes come live from the Sheet. The customer
 * ticks 1–3 sizes they accept; the garments in stock in any of them light up
 * (listed under the picker) and the rest darken. The server re-checks stock
 * when spinning, so the lit state is only a guide.
 */
export default function SizeFilteredSpin({ shopUrl }: { shopUrl: string }) {
  const [catalog, setCatalog] = useState<Catalog>({ gifts: FALLBACK_GIFTS, open: false, live: false, contactUrl: "" });
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<EntryPhase["name"]>("entry");
  const [top, setTop] = useState<string[]>([]);
  const [pants, setPants] = useState<string[]>([]);
  const [initialOrder, setInitialOrder] = useState("");

  const refresh = useCallback(() => {
    loadCatalog().then((response) => {
      setLoading(false);
      if (!response.ok) return;
      // Drop a picked size that has just sold out, so the next spin cannot fail on it again.
      if (response.gifts.length) {
        const topStock = sizeCounts(response.gifts, "top"), pantsStock = sizeCounts(response.gifts, "pants");
        setTop((sizes) => keepInStock(sizes, topStock));
        setPants((sizes) => keepInStock(sizes, pantsStock));
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
  const segments = useMemo(() => toSegments(catalog.gifts, sizes, catalog.live), [catalog.gifts, sizes, catalog.live]);
  const topCounts = useMemo(() => sizeCounts(catalog.gifts, "top"), [catalog.gifts]);
  const pantsCounts = useMemo(() => sizeCounts(catalog.gifts, "pants"), [catalog.gifts]);
  // Garments the customer can win with the sizes picked; size-free gifts are always in the draw.
  const matches = useMemo(
    () => catalog.gifts.filter((gift) => gift.group !== "any" && gift.available && fitsSizes(gift, sizes, catalog.live)),
    [catalog.gifts, sizes, catalog.live],
  );
  const hasTop = catalog.gifts.some((gift) => gift.group === "top");
  // A top size is required only while some top still has stock; otherwise size-free gifts remain.
  const topInStock = catalog.gifts.some((gift) => gift.group === "top" && gift.available);
  const hasPants = catalog.gifts.some((gift) => gift.group === "pants");
  const lit = segments.filter((segment) => !segment.disabled).length;
  const locked = phase === "spinning" || phase === "done";
  const picked = hasSizes(sizes);

  const toggle = (set: Dispatch<SetStateAction<string[]>>, size: string) =>
    set((current) => current.includes(size) ? current.filter((s) => s !== size)
      : current.length >= MAX_SIZES ? current : [...current, size]);

  const groups = [
    { key: "top", label: "Size áo / polo / áo khoác / sơ mi", value: top, set: setTop, counts: topCounts,
      options: sortSizes([...DEFAULT_TOP_SIZES, ...topCounts.keys()]), show: hasTop },
    { key: "pants", label: "Size quần", value: pants, set: setPants, counts: pantsCounts,
      options: sortSizes([...pantsCounts.keys()]), show: hasPants },
  ];

  const controls = (
    <section id="size-picker" className="size-selection" aria-label="Chọn size trước khi quay">
      <p className="info-index">01 · CHỌN SIZE TRƯỚC KHI QUAY</p>
      <p>Tick 1–{MAX_SIZES} size bạn mặc vừa. Chọn càng nhiều size, càng nhiều mẫu quà trên vòng quay.</p>
      <div className="size-groups">
        {groups.filter((group) => group.show).map((group) => (
          <fieldset key={group.key} disabled={locked}>
            <legend>{group.label} <small>· {group.value.length}/{MAX_SIZES}</small></legend>
            <div>
              {group.options.map((size) => {
                const count = group.counts.get(size) ?? 0;
                const pressed = group.value.includes(size);
                // Only the live Sheet knows real stock; the offline snapshot never blocks a size.
                const soldOut = catalog.live && count === 0;
                const full = !pressed && group.value.length >= MAX_SIZES;
                return (
                  <button key={size} type="button" aria-pressed={pressed} disabled={soldOut || full} data-full={full && !soldOut ? "" : undefined}
                    title={soldOut ? `Size ${size} đã hết quà` : full ? `Tối đa ${MAX_SIZES} size — bỏ bớt 1 size để chọn size khác` : catalog.live ? `${count} mẫu quà có size ${size}` : `Xem trước size ${size} — chưa xác nhận tồn kho`}
                    onClick={() => toggle(group.set, size)}>
                    {pressed ? <i aria-hidden="true">✓</i> : null}
                    <span>{size}</span>
                    {catalog.live ? <small>{soldOut ? "hết" : `${count} mẫu`}</small> : null}
                  </button>
                );
              })}
            </div>
            {!group.options.length ? <small>Chưa có size quần trong quỹ quà.</small> : null}
          </fieldset>
        ))}
      </div>
      <p aria-live="polite" className="size-summary">
        {picked
          ? <><strong>{lit}</strong> / {segments.length} ô sáng: {catalog.live ? "mẫu còn quà đúng size bạn chọn và quà không cần size." : "minh hoạ bộ lọc, chưa xác nhận size và tồn kho thật."}</>
          : "Chọn size để làm sáng các mẫu còn quà đúng size. Người quay sớm có nhiều lựa chọn size hơn."}
      </p>
      {picked ? (
        <div className="size-matches">
          <p>
            {matches.length
              ? <>{catalog.live ? "Mẫu còn size" : "Mẫu minh hoạ khi chọn"} <strong>{[...sortSizes(top), ...sortSizes(pants)].join(" · ")}</strong> ({matches.length} mẫu):</>
              : "Chưa có mẫu áo/quần nào còn size bạn chọn — bạn vẫn có thể trúng quà không cần size. Thử tick thêm size khác."}
          </p>
          {matches.length ? (
            <ul>
              {matches.map((gift) => {
                const { label, caption } = wheelLabel(gift.name);
                return <li key={gift.id}><small>{caption}</small>{label}</li>;
              })}
            </ul>
          ) : null}
          {!catalog.live ? <small>Bản xem trước: size thật của từng mẫu được cập nhật từ kho quà khi kết nối hệ thống.</small> : null}
        </div>
      ) : null}
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
