"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import CodeEntryCard, { type EntryPhase } from "@/components/spin/CodeEntryCard";
import Confetti from "@/components/spin/Confetti";
import LuckyWheel from "@/components/spin/LuckyWheel";
import ResultModal from "@/components/spin/ResultModal";
import { requestSpin, validateCode, WINNER_EVENT, type Credentials } from "@/components/spin/api";
import { useReducedMotion } from "@/components/spin/useReducedMotion";
import { LUCKY_ERROR_MESSAGES, type SpinResultView, type WheelSegmentView } from "@/lib/lucky-types";
import { cosmeticJitter, targetRotation } from "@/lib/wheel";

const SPIN_DURATION_MS = 4600;
const REDUCED_MOTION_DURATION_MS = 500;
const CONFETTI_MS = 3200;
const NO_SIZES = { top: [], pants: [] };

type SpinExperienceProps = {
  segments: WheelSegmentView[];
  shopUrl: string;
  sizeControls?: ReactNode;
  /** Read at spin time, so the customer may change sizes after checking the order. Up to 3 per group. */
  selectedSizes?: { top: string[]; pants: string[] };
  requireTopSize?: boolean;
  /** Zalo OA link shown on the result. */
  contactUrl?: string;
  /** Order number from the link (?order=1284), pre-filled in the form. */
  initialOrder?: string;
  onPhaseChange?: (phase: EntryPhase["name"]) => void;
  /** Called when the server reports a size or the whole pool ran out. */
  onStockChanged?: () => void;
};

/**
 * Customer flow: code + phone -> validate -> QUAY NGAY -> server decides the
 * prize -> wheel animates to the returned segment -> result modal.
 * The browser never picks a prize.
 */
export default function SpinExperience({
  segments,
  shopUrl,
  sizeControls,
  selectedSizes = NO_SIZES,
  requireTopSize = false,
  contactUrl = "",
  initialOrder = "",
  onPhaseChange,
  onStockChanged,
}: SpinExperienceProps) {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<EntryPhase>({ name: "entry" });
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [consentFullName, setConsentFullName] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [winningIndex, setWinningIndex] = useState<number | null>(null);
  const [result, setResult] = useState<SpinResultView | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [wheelInView, setWheelInView] = useState(true);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", escape); };
  }, [expanded]);
  const spinLock = useRef(false);
  const readyPhase = useRef<Extract<EntryPhase, { name: "ready" }> | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const pendingResult = useRef<SpinResultView | null>(null);

  const durationMs = reducedMotion ? REDUCED_MOTION_DURATION_MS : SPIN_DURATION_MS;
  // The API takes each group as "M,L"; a single size stays a plain "M".
  const sizeParams = { top: selectedSizes.top.join(","), pants: selectedSizes.pants.join(",") };

  useEffect(() => {
    const node = wheelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setWheelInView(entry.isIntersecting), {
      threshold: 0.35,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    onPhaseChange?.(phase.name);
  }, [phase.name, onPhaseChange]);

  useEffect(() => {
    if (!showConfetti) return;
    const timer = window.setTimeout(() => setShowConfetti(false), CONFETTI_MS);
    return () => window.clearTimeout(timer);
  }, [showConfetti]);

  const segmentIndexFor = useCallback(
    (spin: SpinResultView): number => {
      const byId = segments.findIndex((segment) => segment.id === spin.prizeId);
      if (byId >= 0) return byId;
      return Math.min(spin.segmentIndex, Math.max(segments.length - 1, 0));
    },
    [segments],
  );

  const showHistory = useCallback(
    (spin: SpinResultView) => {
      const index = segmentIndexFor(spin);
      setResult(spin);
      setWinningIndex(index);
      // Point at the earlier result without animating (no new spin happens).
      setRotation((current) => targetRotation(current, index, Math.max(segments.length, 1), 0, 0));
      setPhase({ name: "done", result: spin, isHistory: true });
      setModalOpen(true);
      setAnnouncement(`Đơn này đã quay: ${spin.prizeHeadline}`);
    },
    [segmentIndexFor, segments.length],
  );

  async function handleSubmit(code: string, contact = "") {
    setError(null);
    if (!code.trim()) {
      setError(LUCKY_ERROR_MESSAGES.VALIDATION);
      return;
    }
    setPhase({ name: "checking" });
    setAnnouncement("Đang kiểm tra đơn hàng...");
    const nextCredentials = { code: code.trim(), contact: contact.trim() };
    const response = await validateCode({ ...nextCredentials, ...sizeParams });

    if (!response.ok) {
      setPhase({ name: "entry" });
      setError(response.message);
      setAnnouncement(response.message);
      return;
    }
    setCredentials(nextCredentials);
    if (response.state === "ALREADY_SPUN") {
      showHistory(response.result);
      return;
    }
    const ready = { name: "ready", customerName: response.customerName, askNameConsent: response.askNameConsent } as const;
    readyPhase.current = ready;
    setPhase(ready);
    setAnnouncement("Đơn hợp lệ. Bạn có 01 lượt quay.");
    if (!wheelInView) wheelRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
  }

  async function handleSpin() {
    if (phase.name !== "ready" || !credentials || spinLock.current) return;
    if (requireTopSize && !selectedSizes.top.length) {
      const message = "Vui lòng tick ít nhất 1 size áo trước khi quay.";
      setError(message);
      setAnnouncement(message);
      document.getElementById("size-picker")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
      return;
    }
    spinLock.current = true;
    setError(null);
    setPhase({ name: "spinning" });
    setAnnouncement("Đang quay…");
    wheelRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });

    const response = await requestSpin({ ...credentials, ...sizeParams, consentFullName });
    if (!response.ok) {
      spinLock.current = false;
      // Stock changed under the customer: refresh the wheel and let them pick another size.
      const stock = response.error === "SIZE_UNAVAILABLE" || response.error === "NO_PRIZES";
      if (stock) onStockChanged?.();
      const retryable = stock || response.error === "NETWORK" || response.error === "SERVER_ERROR" || response.error === "RATE_LIMITED";
      setPhase(retryable && readyPhase.current ? readyPhase.current : { name: "entry" });
      setError(response.message);
      setAnnouncement(response.message);
      return;
    }

    if (response.repeated) {
      // Already spun (other tab / retried request): show the saved result, no new spin.
      spinLock.current = false;
      showHistory(response.result);
      return;
    }

    const index = segmentIndexFor(response.result);
    pendingResult.current = response.result;
    setWinningIndex(null);
    setIsAnimating(true);
    setRotation((current) =>
      targetRotation(
        current,
        index,
        Math.max(segments.length, 1),
        reducedMotion ? 1 : 6,
        cosmeticJitter(response.result.spinId, Math.max(segments.length, 1)),
      ),
    );
  }

  const handleSpinEnd = useCallback(() => {
    const spin = pendingResult.current;
    if (!spin) return;
    pendingResult.current = null;
    spinLock.current = false;
    setIsAnimating(false);
    setWinningIndex(segmentIndexFor(spin));
    setResult(spin);
    setPhase({ name: "done", result: spin, isHistory: false });
    setModalOpen(true);
    setShowConfetti(!reducedMotion);
    setAnnouncement(`Chúc mừng! Bạn nhận được ${spin.prizeHeadline}`);
    window.dispatchEvent(new Event(WINNER_EVENT));
  }, [reducedMotion, segmentIndexFor]);

  function handleReset() {
    setPhase({ name: "entry" });
    setCredentials(null);
    setResult(null);
    setWinningIndex(null);
    setError(null);
    setConsentFullName(false);
    setModalOpen(false);
  }

  function handleResultUpdate(updated: SpinResultView) {
    setResult(updated);
    setPhase((current) => (current.name === "done" ? { ...current, result: updated } : current));
  }

  const canSpin = phase.name === "ready" && !isAnimating;
  const showStickySpin = phase.name === "ready" && !wheelInView;

  return (
    <section id="quay" aria-labelledby="code-title" className="relative mx-auto spin-stage max-w-[1280px] px-5 pb-12 sm:px-8">
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
        <div className="order-2"><CodeEntryCard
          key={initialOrder}
          initialCode={initialOrder}
          phase={phase}
          error={error}
          consentFullName={consentFullName}
          onConsentChange={setConsentFullName}
          onSubmit={handleSubmit}
          onSpin={handleSpin}
          onShowResult={() => setModalOpen(true)}
          onReset={handleReset}
        /></div>

        <div ref={wheelRef} className={`wheel-panel order-1 flex flex-col items-center pt-6${expanded ? " wheel-expanded" : ""}`}>
          <button type="button" className="wheel-expand" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "✕ Đóng toàn màn hình" : "⛶ Xem toàn màn hình"}</button>
          <LuckyWheel
            segments={segments}
            rotation={rotation}
            durationMs={durationMs}
            isSpinning={isAnimating}
            winningIndex={winningIndex}
            canSpin={canSpin}
            onSpinClick={handleSpin}
            onSpinEnd={handleSpinEnd}
          />
          {sizeControls}
          <p className="mt-6 text-center text-xs tracking-[0.25em] text-ivory/55">
            01 MÃ / 01 LƯỢT QUAY / 01 MÓN QUÀ
          </p>
        </div>
      </div>

      <p className="sr-only" aria-live="assertive">
        {announcement}
      </p>

      {/* Mobile helper: jump back to the wheel without covering it */}
      {showStickySpin ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gold/30 bg-navy-dark/95 p-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => wheelRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" })}
            className="h-12 w-full rounded-full bg-gold text-sm font-semibold tracking-[0.2em] text-navy-dark"
          >
            QUAY NGAY
          </button>
        </div>
      ) : null}

      {showConfetti ? <Confetti /> : null}

      <ResultModal
        open={modalOpen}
        result={result}
        isHistory={phase.name === "done" && phase.isHistory}
        credentials={credentials}
        shopUrl={shopUrl}
        contactUrl={contactUrl}
        onClose={() => setModalOpen(false)}
        onResultUpdate={handleResultUpdate}
      />
    </section>
  );
}
