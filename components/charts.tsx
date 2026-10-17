"use client";
import { useEffect, useId, useRef, useState } from "react";
import { fmtInt, localizeDigits, sep } from "@/lib/format";

/* ---------------------------------------------------------------------------
   Chart kit. One system for every chart in the app:
   - colours come from CSS variables (app/globals.css), so light and dark
     are both designed, not inverted;
   - one series = one colour (the brand green); stacked splits use the
     validated green → violet → magenta → grey set;
   - thin marks, 4px rounded data-ends anchored at the baseline, hairline
     grid, recessive axes, hover tooltip on every mark, selective labels;
   - every tick label goes through localizeDigits so Arabic screens read ٠–٩.
--------------------------------------------------------------------------- */

export const CHART = {
  s1: "var(--chart-1)",
  s1soft: "var(--chart-1-soft)",
  s2: "var(--chart-2)",
  s3: "var(--chart-3)",
  neutral: "var(--chart-neutral)",
  neg: "var(--chart-neg)",
  grid: "var(--chart-grid)",
  axis: "var(--chart-axis)",
  text: "var(--chart-text)",
  /** the selected / best mark: deep emerald in light, bright mint in dark */
  ink: "var(--chart-sel)",
  top: "var(--chart-1-top)",
};

export const RAMP = ["var(--ramp-1)", "var(--ramp-2)", "var(--ramp-3)", "var(--ramp-4)", "var(--ramp-5)", "var(--ramp-6)", "var(--ramp-7)"];
export const RAMP_EMPTY = "var(--ramp-empty)";

/** Pick a ramp step for a value in [min, max]. */
export function rampColor(value: number, min: number, max: number): string {
  if (max <= min) return RAMP[3];
  const f = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return RAMP[Math.min(RAMP.length - 1, Math.floor(f * RAMP.length))];
}

export type Bar = { key: string; label: string; value: number; sub?: string; selected?: boolean; muted?: boolean };

/** Tooltip bubble positioned over the chart. */
function Tip({ x, title, value, sub }: { x: number; title: string; value: string; sub?: string }) {
  const left = Math.max(12, Math.min(88, x));
  return (
    <div className="absolute top-0 -translate-x-1/2 bg-sheet border border-line shadow-md rounded-xl px-3 py-2 text-xs pointer-events-none z-10 whitespace-nowrap animate-fade-in" style={{ left: `${left}%` }}>
      <div className="text-muted tnum">{title}</div>
      <div className="font-bold tnum text-sm">{value}</div>
      {sub && <div className="text-muted tnum">{sub}</div>}
    </div>
  );
}

/**
 * Vertical bars on a zero baseline. Negative values hang below in red.
 * `selected` bars are drawn in ink and labelled; the maximum is labelled too.
 */
export function BarChart({
  bars,
  locale = "en",
  fmt,
  onSelect,
  height = 170,
  labelEvery = 1,
  emphasizeMax = true,
}: {
  bars: Bar[];
  locale?: string;
  fmt: (v: number) => string;
  onSelect?: (key: string) => void;
  height?: number;
  labelEvery?: number;
  emphasizeMax?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  // draw at the real pixel width so labels keep their size on wide screens
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(480);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = height;
  const PAD = { top: 26, bottom: 24, left: 8, right: 8 };
  const vals = bars.map((b) => b.value);
  const max = Math.max(...vals, 0);
  const min = Math.min(...vals, 0);
  const span = max - min || 1;
  const plotH = H - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + ((max - v) / span) * plotH;
  const zeroY = y(0);
  const bw = (W - PAD.left - PAD.right) / Math.max(bars.length, 1);
  const barW = Math.min(bw * 0.58, 36);
  const r = Math.min(4, barW / 2);
  const maxIdx = emphasizeMax && max > 0 ? vals.indexOf(max) : -1;
  const gid = `bar${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const path = (cx: number, v: number) => {
    const x0 = cx - barW / 2;
    const yv = y(v);
    const h = Math.abs(zeroY - yv);
    if (h < 0.5) return "";
    if (v >= 0) return `M${x0},${zeroY} L${x0},${yv + r} Q${x0},${yv} ${x0 + r},${yv} L${x0 + barW - r},${yv} Q${x0 + barW},${yv} ${x0 + barW},${yv + r} L${x0 + barW},${zeroY} Z`;
    return `M${x0},${zeroY} L${x0},${yv - r} Q${x0},${yv} ${x0 + r},${yv} L${x0 + barW - r},${yv} Q${x0 + barW},${yv} ${x0 + barW},${yv - r} L${x0 + barW},${zeroY} Z`;
  };

  return (
    <div ref={box} className="relative" dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="block" role="img">
        <defs>
          <linearGradient id={gid} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor={CHART.s1} />
            <stop offset="1" stopColor={CHART.top} />
          </linearGradient>
        </defs>
        {[max, max / 2].map(
          (g, i) => g > 0 && <line key={i} x1={PAD.left} x2={W - PAD.right} y1={y(g)} y2={y(g)} stroke={CHART.grid} strokeWidth="1" />
        )}
        <line x1={PAD.left} x2={W - PAD.right} y1={zeroY} y2={zeroY} stroke={CHART.axis} strokeWidth="1" />
        {bars.map((b, i) => {
          const cx = PAD.left + bw * i + bw / 2;
          const fill = b.value < 0 ? CHART.neg : b.selected ? CHART.ink : b.muted ? CHART.s1soft : `url(#${gid})`;
          const labelled = b.selected || i === maxIdx;
          return (
            <g key={b.key} onClick={() => onSelect?.(b.key)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className={onSelect ? "cursor-pointer" : ""}>
              <rect x={PAD.left + bw * i} y={0} width={bw} height={H} fill="transparent" />
              <path d={path(cx, b.value)} fill={fill} opacity={hover != null && hover !== i ? 0.55 : 1} style={{ transition: "opacity 120ms" }} />
              {labelled && b.value !== 0 && (
                <text x={cx} y={b.value >= 0 ? y(b.value) - 7 : y(b.value) + 14} textAnchor="middle" fontSize="12" fontWeight={700} fill="var(--ink)">
                  {fmt(b.value)}
                </text>
              )}
              {i % labelEvery === 0 && (
                <text x={cx} y={H - 6} textAnchor="middle" fontSize="11" fill={b.selected ? "var(--ink)" : CHART.text} fontWeight={b.selected ? 700 : 500}>
                  {localizeDigits(b.label, locale)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover != null && bars[hover] && <Tip x={((PAD.left + bw * hover + bw / 2) / W) * 100} title={localizeDigits(bars[hover].label, locale)} value={fmt(bars[hover].value)} sub={bars[hover].sub} />}
    </div>
  );
}

export type HBar = { key: string; label: string; value: number; display: string; sub?: string; best?: boolean; muted?: boolean; color?: string };

/**
 * Horizontal bar rows — a ranked list that is also a chart. The label
 * column stays readable at phone width; the bar fills the middle; the value
 * is right-aligned in tabular digits. The `best` row is drawn in ink.
 */
export function HBars({ rows, locale = "en", onSelect, labelWidth = "4.5rem", valueWidth = "6rem", showRank = false }: { rows: HBar[]; locale?: string; onSelect?: (key: string) => void; labelWidth?: string; valueWidth?: string; showRank?: boolean }) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => {
        const Row = (onSelect ? "button" : "div") as "button" | "div";
        return (
          <Row key={r.key} onClick={onSelect ? () => onSelect(r.key) : undefined} className={`flex items-center gap-3 w-full text-start ${r.muted ? "opacity-45" : ""} ${onSelect ? "hover:bg-surface-2 rounded-lg -mx-1 px-1" : ""}`}>
            {showRank && <span className="w-5 text-center text-xs font-bold text-muted tnum shrink-0">{fmtInt(i + 1, locale)}</span>}
            <span dir="auto" className="text-[13px] font-bold text-ink-500 shrink-0 truncate text-start" style={{ width: labelWidth }}>
              {r.label}
            </span>
            <div className="flex-1 h-6 rounded-lg bg-surface-2 overflow-hidden relative" dir="ltr">
              {r.value !== 0 && (
                <div
                  className="absolute inset-y-0 start-0 rounded-lg transition-[width] duration-500"
                  style={{
                    width: `${(Math.abs(r.value) / max) * 100}%`,
                    background: r.value < 0 ? CHART.neg : r.best ? CHART.ink : r.color ?? `linear-gradient(90deg, ${CHART.s1}, ${CHART.top})`,
                  }}
                />
              )}
            </div>
            <span className="text-end text-[15px] font-bold tnum shrink-0" style={{ width: valueWidth }}>
              {r.display}
            </span>
            {r.sub !== undefined && <span className="hidden sm:block w-28 text-end text-xs text-muted tnum shrink-0 truncate">{r.sub}</span>}
            {r.best !== undefined && <span className="w-4 text-center">{r.best ? "🏆" : ""}</span>}
          </Row>
        );
      })}
    </div>
  );
}

/** 24 cells for the hours of a day, one hue light → dark. */
export function HeatStrip({ hours, locale = "en", fmt, t }: { hours: { hour: number; value: number; sub?: string }[]; locale?: string; fmt: (v: number) => string; t: (k: string, v?: Record<string, string | number>) => string }) {
  const [tip, setTip] = useState<number | null>(null);
  const max = Math.max(...hours.map((h) => h.value), 0);
  if (max <= 0) return <div className="text-center text-muted py-6 text-sm">{t("c.noData")}</div>;
  return (
    <div dir="ltr">
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: "repeat(24, 1fr)" }}>
        {hours.map((h) => (
          <button
            type="button"
            key={h.hour}
            className={`h-10 rounded-[4px] transition-transform ${tip === h.hour ? "scale-y-110 ring-2 ring-ink/40" : ""}`}
            style={{ background: h.value <= 0 ? RAMP_EMPTY : rampColor(h.value, 0, max) }}
            onMouseEnter={() => setTip(h.hour)}
            onMouseLeave={() => setTip(null)}
            onClick={() => setTip(tip === h.hour ? null : h.hour)}
            aria-label={`${h.hour}:00 ${fmt(h.value)}`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted tnum mt-1">
        {[0, 6, 12, 18, 24].map((h) => (
          <span key={h}>{localizeDigits(String(h).padStart(2, "0"), locale)}</span>
        ))}
      </div>
      <div className="text-xs text-ink-500 mt-1.5 tnum min-h-4">
        {tip != null ? (
          <>
            {localizeDigits(`${String(tip).padStart(2, "0")}:00–${String((tip + 1) % 24).padStart(2, "0")}:00`, locale)}{sep(locale)}<b>{fmt(hours[tip].value)}</b>
            {hours[tip].sub && <>{sep(locale)}{hours[tip].sub}</>}
          </>
        ) : (
          <span className="text-muted">{t("ch.tapHour")}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Weekday × hour heat grid (the planner). Rows in pay-week order (Monday
 * first); cells without enough data are drawn empty, never zero.
 */
export function HeatGrid({
  cells,
  dowOrder,
  dayName,
  locale = "en",
  fmt,
  t,
}: {
  cells: { dow: number; hour: number; ratePerHour: number | null; trips: number; hours: number }[];
  dowOrder: number[];
  dayName: (dow: number, style?: "short" | "long") => string;
  locale?: string;
  fmt: (v: number) => string;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  const [tip, setTip] = useState<{ dow: number; hour: number } | null>(null);
  const rates = cells.filter((c) => c.ratePerHour != null).map((c) => c.ratePerHour!);
  if (rates.length === 0) return <div className="text-center text-muted py-6 text-sm">{t("pl.noData")}</div>;
  const maxRate = Math.max(...rates);
  const minRate = Math.min(...rates);
  const cellAt = (dow: number, hour: number) => cells[dow * 24 + hour];
  const sel = tip ? cellAt(tip.dow, tip.hour) : null;
  return (
    <div dir="ltr">
      <div>
        <div className="grid" style={{ gridTemplateColumns: "2.2rem repeat(24, minmax(0, 1fr))", gap: 2 }}>
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-[9px] text-muted text-center tnum">
              {h % 6 === 0 ? localizeDigits(h, locale) : ""}
            </div>
          ))}
          {dowOrder.map((dow) => (
            <div key={dow} className="contents">
              <div className="text-[10px] text-ink-500 font-bold flex items-center truncate">{dayName(dow)}</div>
              {Array.from({ length: 24 }, (_, h) => {
                const c = cellAt(dow, h);
                const active = tip?.dow === dow && tip?.hour === h;
                return (
                  <button
                    type="button"
                    key={h}
                    className={`h-6 min-w-0 rounded-[2px] ${active ? "ring-2 ring-ink/50" : ""}`}
                    style={{ background: c.ratePerHour == null ? RAMP_EMPTY : rampColor(c.ratePerHour, minRate, maxRate) }}
                    onMouseEnter={() => setTip({ dow, hour: h })}
                    onMouseLeave={() => setTip(null)}
                    onClick={() => setTip(active ? null : { dow, hour: h })}
                    aria-label={`${dayName(dow, "long")} ${h}:00`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 text-[10px] text-muted tnum flex-wrap">
        <span>{fmt(minRate)}</span>
        {RAMP.map((c) => (
          <span key={c} className="inline-block w-5 h-2.5 rounded-sm" style={{ background: c }} />
        ))}
        <span>{fmt(maxRate)}</span>
        <span className="ms-2 inline-block w-5 h-2.5 rounded-sm" style={{ background: RAMP_EMPTY }} />
        <span>{t("pl.noSample")}</span>
      </div>
      <div className="text-xs text-ink-500 mt-1.5 tnum min-h-4">
        {sel && tip ? (
          <>
            {dayName(tip.dow, "long")} {localizeDigits(`${String(tip.hour).padStart(2, "0")}:00–${String((tip.hour + 1) % 24).padStart(2, "0")}:00`, locale)}{sep(locale)}
            <b>{sel.ratePerHour != null ? `${fmt(sel.ratePerHour)}/${t("c.hours")}` : t("pl.noSample")}</b>{sep(locale)}{t("pl.tripsN", { n: sel.trips })}
          </>
        ) : (
          <span className="text-muted">{t("ch.tapCell")}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Ring gauge — progress toward a goal with a real ceiling (weekly profit
 * goal, today's target). Same-hue lighter track; the centre carries the
 * figure. Past 100% the ring stays full and turns gold.
 */
export function Ring({
  ratio,
  size = 132,
  thickness = 14,
  children,
  label,
}: {
  ratio: number;
  size?: number;
  thickness?: number;
  children?: React.ReactNode;
  label?: string;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const done = ratio >= 1;
  const gid = `ring${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={done ? "var(--gold)" : CHART.top} />
            <stop offset="1" stopColor={done ? "var(--gold)" : CHART.s1} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={done ? "var(--gold-soft)" : CHART.s1soft} strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - f)}
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3">{children}</div>
    </div>
  );
}
