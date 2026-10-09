import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import type { LeadOffer } from "@coverview/api-client/partner";
import { CompanyLogo } from "../insurance/CompanyLogo";
import { companyPalette } from "./company-colors";
import { offerMetrics, type MetricValue } from "./offer-metrics";
import { PixelField } from "./PixelField";
import { amountsInText, numberFormat } from "../../number-format";

const Shader = lazy(() => import("./OfferShader"));

// Without WebGL the colours stay as a still gradient.
class ShaderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The top of an offer page (8 October 2026), across the whole screen: the company's colours as an
 * animated gradient blurred behind flickering pixels, the way back, the product and company, two
 * figures that depend on the need, and dots to move between the offers of the same request, by
 * tapping or by swiping.
 */
export function OfferHero({
  offer,
  category,
  siblings,
  index,
  onMove,
  onBack,
}: {
  offer: LeadOffer;
  category: string;
  siblings: LeadOffer[];
  index: number;
  onMove: (index: number) => void;
  onBack: () => void;
}) {
  const { t, i18n } = useTranslation("offers");
  const palette = companyPalette(offer.companyId);
  const [still, setStill] = useState(true);
  const start = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setStill(reduce.matches || document.visibilityState !== "visible");
    update();
    reduce.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      reduce.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const figure = (value: MetricValue) => {
    if (value.kind === "missing") return { main: t("missing"), unit: "", period: "" };
    if (value.kind === "text")
      return { main: amountsInText(value.text, i18n.language), unit: "", period: "" };
    if (value.kind === "date")
      return {
        main: new Intl.DateTimeFormat(i18n.language, {
          dateStyle: "medium",
          timeZone: "Europe/Zurich",
        }).format(new Date(value.at)),
        unit: "",
        period: "",
      };
    return {
      main: numberFormat(i18n.language, {
        minimumFractionDigits: value.minor % 100 ? 2 : 0,
        maximumFractionDigits: 2,
      }).format(value.minor / 100),
      unit: t("offerPage.chf"),
      period: value.per ? t(`offerPage.per.${value.per}`) : "",
    };
  };
  const initials = offer.company
    .split(/\s+/u)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <section
      aria-label={t("offerPage.heroLabel", { company: offer.company, product: offer.product })}
      className="cv-full-bleed relative isolate touch-pan-y select-none overflow-hidden text-white"
      style={{
        background: `radial-gradient(ellipse at 85% 0%, ${palette[2]}, transparent 55%), radial-gradient(ellipse at 10% 100%, ${palette[1]}, transparent 60%), ${palette[0]}`,
      }}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        start.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
      onPointerUp={(event) => {
        const from = start.current;
        start.current = null;
        if (!from) return;
        const dx = event.clientX - from.x;
        const dy = event.clientY - from.y;
        // A horizontal swipe moves to the next or previous offer; scrolling stays vertical.
        if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        const next = index + (dx < 0 ? 1 : -1);
        if (next >= 0 && next < siblings.length) onMove(next);
      }}
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <ShaderBoundary>
          <Suspense fallback={null}>
            <Shader colors={palette} still={still} />
          </Suspense>
        </ShaderBoundary>
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-black/60 via-black/15 to-transparent"
      />
      {/* The gradient is blurred behind the content; the pixels stay sharp above it. */}
      <div
        className={`relative flex min-h-72 flex-col justify-end gap-6 py-6 backdrop-blur-[60px] sm:min-h-80 sm:py-8 ${
          siblings.length > 1 ? "pb-2 sm:pb-3" : ""
        }`}
      >
        <PixelField className="pointer-events-none absolute inset-0 size-full" />
        <div className="cv-offer-hero-inner relative flex flex-1 flex-col justify-between gap-6">
          <button
            type="button"
            className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
            onClick={onBack}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("offerPage.back")}
          </button>
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-white p-2 shadow-sm">
                {offer.companyId ? (
                  <CompanyLogo companyId={offer.companyId} className="max-h-10 max-w-12" />
                ) : (
                  <span aria-hidden="true" className="text-lg font-semibold text-[#111e38]">
                    {initials}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold leading-tight text-balance">
                  {offer.product}
                </h1>
                <p className="text-white/75">{offer.company}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-6">
              {offerMetrics(offer, category).map(({ label, value }) => {
                const { main, unit, period } = figure(value);
                return (
                  <div key={label} className="min-w-0">
                    <dt className="text-sm text-white/75">{t(`offerPage.metrics.${label}`)}</dt>
                    <dd className="mt-1 flex items-center gap-2 text-2xl font-semibold sm:text-3xl">
                      <span className="min-w-0 break-words">{main}</span>
                      {/* The currency over the period, as on the offer cards. */}
                      {unit && (
                        <span className="flex flex-col text-xs leading-tight font-medium text-white/70">
                          <span>{unit}</span>
                          {period && <span>{period}</span>}
                        </span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
            {siblings.length > 1 && (
              <div
                className="-mt-4 flex justify-center gap-1"
                role="group"
                aria-label={t("offerPage.dots")}
              >
                {siblings.map((item, position) => (
                  <button
                    key={item.id}
                    type="button"
                    className="grid h-6 min-w-6 place-items-center"
                    aria-label={t("offerPage.dot", {
                      index: position + 1,
                      total: siblings.length,
                      name: `${item.company} · ${item.product}`,
                    })}
                    aria-current={position === index ? "true" : undefined}
                    onClick={() => onMove(position)}
                  >
                    <span
                      className={`h-2 rounded-full transition-all ${
                        position === index ? "w-6 bg-white" : "w-2 bg-white/45"
                      }`}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
