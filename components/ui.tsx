"use client";
import { useEffect, useState } from "react";

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-[var(--border)] shadow-[var(--shadow-sm)] ${
        padded ? "p-4 md:p-5" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** Card header with a consistent title/subtitle/action rhythm, so every
 *  panel in the app reads the same way instead of each page inventing one. */
export function CardHead({
  icon,
  title,
  sub,
  actions,
}: {
  icon?: string;
  title: string;
  sub?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon && <span className="text-base leading-none">{icon}</span>}
          <h2 className="text-sm font-bold tracking-tight">{title}</h2>
        </div>
        {sub && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{sub}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

export function PageTitle({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
      <h1 className="text-2xl font-black tracking-tight">{children}</h1>
      {actions}
    </div>
  );
}

export function Btn({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  className = "",
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger" | "ghost" | "big";
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const styles = {
    primary:
      "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-4 py-2.5 text-sm shadow-sm",
    secondary:
      "bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-[var(--border)] px-4 py-2.5 text-sm",
    danger: "bg-white hover:bg-red-50 text-red-600 border border-red-200 px-3 py-2 text-xs",
    ghost: "bg-transparent hover:bg-slate-100 text-slate-600 px-3 py-2 text-sm",
    big: "bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-6 py-4 text-lg w-full shadow-[var(--shadow-md)]",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-xl font-semibold transition-all disabled:opacity-45 disabled:cursor-not-allowed active:scale-[0.98] ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-400 mt-1 leading-relaxed">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500 bg-white transition-shadow";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={2} {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4.5 h-4.5 accent-emerald-600"
      />
      {label}
    </label>
  );
}

export function Badge({
  children,
  tone = "neutral",
  title,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "brand";
  title?: string;
}) {
  const tones = {
    neutral: "bg-slate-100 text-slate-600",
    good: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    warn: "bg-amber-50 text-amber-700 border border-amber-200",
    bad: "bg-red-50 text-red-700 border border-red-200",
    brand: "bg-emerald-600 text-white",
  }[tone];
  return (
    <span title={title} className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1 ${tones}`}>
      {children}
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-center text-slate-400 py-12 text-sm">{children}</div>;
}

/** Collapsible "Add" form wrapper. */
export function AddPanel({
  buttonLabel,
  children,
  open,
  setOpen,
}: {
  buttonLabel: string;
  children: React.ReactNode;
  open?: boolean;
  setOpen?: (v: boolean) => void;
}) {
  const [internal, setInternal] = useState(false);
  const isOpen = open ?? internal;
  const toggle = setOpen ?? setInternal;
  return (
    <div className="mb-4">
      {!isOpen ? (
        <Btn onClick={() => toggle(true)}>+ {buttonLabel}</Btn>
      ) : (
        <Card className="border-emerald-300 ring-2 ring-emerald-500/10">
          <div className="flex justify-between items-center mb-4">
            <span className="font-bold text-sm">{buttonLabel}</span>
            <button
              onClick={() => toggle(false)}
              className="text-slate-400 hover:text-slate-700 w-8 h-8 rounded-lg hover:bg-slate-100 transition-colors"
            >
              ✕
            </button>
          </div>
          {children}
        </Card>
      )}
    </div>
  );
}

/**
 * Centred sheet. Used for record editing so a wide table's horizontal scroll
 * can never clip the form — the sheet is portal-free but rendered fixed to
 * the viewport, so it is always fully visible without sideways scrolling.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    // stop the page behind from scrolling under the sheet
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative bg-white w-full ${wide ? "md:max-w-3xl" : "md:max-w-xl"} max-h-[92vh] overflow-y-auto
                    rounded-t-2xl md:rounded-2xl shadow-[var(--shadow-lg)] animate-sheet-in`}
      >
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-[var(--border)] px-4 md:px-5 py-3 flex items-center justify-between rounded-t-2xl">
          <h3 className="font-bold text-sm">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 w-9 h-9 rounded-lg hover:bg-slate-100 transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-4 md:p-5">{children}</div>
      </div>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onPage,
  labelPrev,
  labelNext,
  labelPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
  labelPrev: string;
  labelNext: string;
  labelPage: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-[var(--border)]">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="text-sm font-semibold text-emerald-700 disabled:text-slate-300 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg hover:bg-emerald-50 disabled:hover:bg-transparent transition-colors"
      >
        ← {labelPrev}
      </button>
      <span className="text-xs text-slate-400 tnum">{labelPage}</span>
      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        className="text-sm font-semibold text-emerald-700 disabled:text-slate-300 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg hover:bg-emerald-50 disabled:hover:bg-transparent transition-colors"
      >
        {labelNext} →
      </button>
    </div>
  );
}

/**
 * One logged record rendered as a card instead of a table row.
 *
 * A trip carries 16 fields and a shift 12 — no table of that width fits a
 * phone, and forcing the driver to drag sideways to read their own data (or
 * reach the Save button) was the single worst thing about the old layout.
 * A card reflows instead of overflowing, so every field is on screen at any
 * width, with bigger tap targets for someone using this one-handed.
 */
export function RecordCard({
  children,
  tone = "plain",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "plain" | "warn";
  className?: string;
}) {
  const tones = {
    plain: "bg-white border-[var(--border)] hover:border-slate-300",
    warn: "bg-amber-50/60 border-amber-200 hover:border-amber-300",
  }[tone];
  return (
    <div className={`rounded-xl border ${tones} px-3.5 py-3 transition-colors ${className}`}>{children}</div>
  );
}

/** A labelled value inside a RecordCard. Wraps rather than overflowing. */
export function StatCell({
  label,
  value,
  tone = "default",
  title,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "muted" | "good" | "warn" | "bad";
  title?: string;
}) {
  const tones = {
    default: "text-slate-800",
    muted: "text-slate-400",
    good: "text-emerald-700",
    warn: "text-amber-600",
    bad: "text-red-600",
  }[tone];
  return (
    <div className="min-w-0" title={title}>
      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold truncate">{label}</div>
      <div className={`text-sm font-semibold tnum truncate ${tones}`}>{value}</div>
    </div>
  );
}

/** Responsive field grid: dense on desktop, wraps on a phone, never scrolls. */
export function StatGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: 3 | 4 | 5 | 6 }) {
  const colCls = {
    3: "grid-cols-2 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
    6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
  }[cols];
  return <div className={`grid ${colCls} gap-x-4 gap-y-2.5 mt-2.5`}>{children}</div>;
}

/** Collapsible group header (a shift, a day) sitting above its record cards. */
export function GroupHeader({
  open,
  onToggle,
  title,
  meta,
  right,
  tone = "plain",
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  meta?: React.ReactNode;
  right?: React.ReactNode;
  tone?: "plain" | "warn";
}) {
  const tones = {
    plain: "bg-slate-50 hover:bg-slate-100 border-[var(--border)]",
    warn: "bg-amber-50 hover:bg-amber-100 border-amber-200",
  }[tone];
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-start transition-colors ${tones}`}
    >
      <span className={`text-xs text-slate-400 transition-transform shrink-0 ${open ? "rotate-90" : ""}`}>▶</span>
      <span className="font-bold text-sm truncate">{title}</span>
      {meta && <span className="text-xs text-slate-500 truncate hidden sm:inline">{meta}</span>}
      {right && <span className="ms-auto shrink-0">{right}</span>}
    </button>
  );
}

const METER_TONES = {
  good: "#10b981", // emerald-500
  warn: "#f59e0b", // amber-500
  bad: "#ef4444", // red-500
  brand: "#2a78d6", // series-1 blue
  neutral: "#94a3b8", // slate-400
} as const;

export type MeterTone = keyof typeof METER_TONES;

/**
 * Horizontal progress meter — "how much of this is used up".
 *
 * `ratio` is deliberately uncapped: a part 20% past its service interval is
 * a thing the driver has to see, so the bar fills completely and turns the
 * `bad` tone rather than quietly pretending it sits at 100%.
 * A plain block child fills from the inline start, so this reads correctly
 * in both LTR and the Arabic RTL layout without any extra work.
 */
export function Meter({
  ratio,
  tone = "good",
  label,
  value,
  sub,
  thin = false,
  marker,
}: {
  ratio: number;
  tone?: MeterTone;
  label?: React.ReactNode;
  value?: React.ReactNode;
  sub?: React.ReactNode;
  thin?: boolean;
  /** A second line to read the fill against — a break-even point, a goal. */
  marker?: { ratio: number; label?: string };
}) {
  const filled = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const markAt =
    marker && Number.isFinite(marker.ratio) ? Math.max(0, Math.min(1, marker.ratio)) : null;
  return (
    <div>
      {(label || value) && (
        <div className="flex items-baseline justify-between gap-2 mb-1">
          {label && <span className="text-xs font-semibold text-slate-600 truncate">{label}</span>}
          {value && <span className="text-xs font-semibold tnum whitespace-nowrap">{value}</span>}
        </div>
      )}
      <div className={`relative ${thin ? "h-1.5" : "h-2.5"} rounded-full bg-slate-100 overflow-hidden`}>
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${filled * 100}%`, background: METER_TONES[tone] }}
        />
        {markAt != null && (
          <span
            title={marker!.label}
            className="absolute top-0 bottom-0 w-0.5 bg-slate-700/70 rounded-full"
            style={{ insetInlineStart: `calc(${markAt * 100}% - 1px)` }}
          />
        )}
      </div>
      {/* label pinned to the tick using a spacer rather than a transform, so
          it lands on the right side of the mark in RTL as well as LTR */}
      {markAt != null && marker!.label && (
        <div className="flex mt-0.5 text-[10px] text-slate-500">
          {markAt > 0.8 ? (
            <span className="shrink-0 text-end whitespace-nowrap" style={{ width: `${markAt * 100}%` }}>
              {marker!.label} ▲
            </span>
          ) : (
            <>
              <span className="shrink-0" style={{ width: `${markAt * 100}%` }} />
              <span className="whitespace-nowrap">▲ {marker!.label}</span>
            </>
          )}
        </div>
      )}
      {sub && <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">{sub}</div>}
    </div>
  );
}

/** Segment of a StackedMeter — one slice of a real total. */
export type MeterSegment = { key: string; value: number; color: string; label: string };

/** Proportional bar: several parts of one honest total, in one track. */
export function StackedMeter({ segments }: { segments: MeterSegment[] }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  if (total <= 0) return null;
  return (
    <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100" style={{ gap: 2 }}>
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <div key={s.key} title={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
        ))}
    </div>
  );
}

const GAUGE_ARC_LENGTH = Math.PI * 68;

/**
 * Half-circle gauge for a value that has a real ceiling to read it against
 * (consumption on a 0–20 L/100km dial, a share of earnings on 0–100%).
 * Never used for an open-ended total — a needle with an invented maximum
 * would be decoration pretending to be information.
 */
export function Gauge({
  ratio,
  tone = "brand",
  value,
  unit,
  caption,
  minLabel,
  maxLabel,
}: {
  ratio: number;
  tone?: MeterTone;
  value: string;
  unit?: string;
  caption?: string;
  minLabel?: string;
  maxLabel?: string;
}) {
  const filled = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[160px]">
        <svg viewBox="0 0 160 92" className="w-full" role="img" aria-label={caption ?? value}>
          <path
            d="M 12 80 A 68 68 0 0 1 148 80"
            fill="none"
            stroke="#eef1f4"
            strokeWidth={12}
            strokeLinecap="round"
          />
          <path
            d="M 12 80 A 68 68 0 0 1 148 80"
            fill="none"
            stroke={METER_TONES[tone]}
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={GAUGE_ARC_LENGTH}
            strokeDashoffset={GAUGE_ARC_LENGTH * (1 - filled)}
            style={{ transition: "stroke-dashoffset 600ms ease" }}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-1 text-center">
          <div className="text-2xl font-black tnum leading-none">{value}</div>
          {unit && <div className="text-[10px] font-semibold text-slate-400 mt-0.5">{unit}</div>}
        </div>
      </div>
      {(minLabel || maxLabel) && (
        <div className="flex justify-between w-[160px] -mt-1 text-[10px] text-slate-300 tnum">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
      {caption && <div className="text-[11px] text-slate-500 mt-1 text-center leading-relaxed">{caption}</div>}
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="scroll-x -mx-4 md:-mx-5 px-4 md:px-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-start text-xs text-slate-500 border-b border-[var(--border)]">
            {head.map((h, i) => (
              <th key={i} className="text-start py-2.5 px-2 font-semibold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}
