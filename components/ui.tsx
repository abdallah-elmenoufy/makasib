"use client";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "./icons";

/* ---------------------------------------------------------------------------
   Primitives. Uber-style: grey tiles on a white page, hairline dividers,
   black buttons, one green for money in and one red for money out.
--------------------------------------------------------------------------- */

export function Card({
  children,
  className = "",
  padded = true,
  tone = "tile",
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
  /** tile = grey block (default); outline = white with hairline; ink = black; money/loss = tinted */
  tone?: "tile" | "outline" | "ink" | "money" | "loss" | "warn";
}) {
  const tones = {
    tile: "bg-surface",
    outline: "bg-paper border border-line",
    ink: "bg-hero text-hero-fg ring-1 ring-hero-fg/10",
    money: "bg-money-soft",
    loss: "bg-loss-soft",
    warn: "bg-warn-soft",
  }[tone];
  return <div className={`rounded-2xl ${tones} ${padded ? "p-4 md:p-5" : ""} ${className}`}>{children}</div>;
}

/** Card header: title, optional subtitle and a right-aligned action. */
export function CardHead({
  icon,
  title,
  sub,
  actions,
}: {
  icon?: string | IconName;
  title: string;
  sub?: string;
  actions?: React.ReactNode;
}) {
  const isIcon = icon != null && /^[a-zA-Z]+$/.test(icon);
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon && (isIcon ? <Icon name={icon as IconName} size={18} className="text-ink-500" /> : <span className="text-base leading-none">{icon}</span>)}
          <h2 className="text-[15px] font-bold tracking-tight">{title}</h2>
        </div>
        {sub && <p className="text-xs text-muted mt-1 leading-relaxed">{sub}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 mt-2 mb-2 px-0.5">
      <h2 className="text-lg font-bold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

export function PageTitle({ children, actions, sub }: { children: React.ReactNode; actions?: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
      <div className="min-w-0">
        <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight leading-tight display">{children}</h1>
        {sub && <p className="text-sm text-muted mt-1">{sub}</p>}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
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
  size = "md",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger" | "ghost" | "big" | "money";
  disabled?: boolean;
  className?: string;
  title?: string;
  size?: "sm" | "md";
}) {
  const sizes = size === "sm" ? "px-3 h-9 text-[13px]" : "px-4 h-12 text-sm";
  const styles = {
    primary: `bg-ink hover:bg-ink-700 active:bg-ink-500 text-background ${sizes}`,
    secondary: `bg-surface-2 hover:bg-line active:bg-line-strong text-ink ${sizes}`,
    danger: `bg-paper hover:bg-loss-soft text-loss border border-line ${sizes}`,
    ghost: `bg-transparent hover:bg-surface-2 text-ink-500 ${sizes}`,
    money: `bg-money hover:brightness-95 text-white ${sizes}`,
    big: "bg-ink hover:bg-ink-700 active:bg-ink-500 text-background px-6 h-14 text-base w-full",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.985] ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-bold text-ink-500 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1 leading-relaxed">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl bg-surface-2 border border-transparent px-3.5 h-12 text-[15px] text-ink placeholder:text-muted-2 " +
  "focus:outline-none focus:bg-paper focus:border-ink focus:ring-2 focus:ring-ink/10 transition-colors";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={2} {...props} className={`${inputCls} h-auto py-3 ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none min-h-12">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-5 h-5 accent-ink" />
      {label}
    </label>
  );
}

/** iOS/Uber-style switch — for the one setting a driver flips (depreciation on/off). */
export function Toggle({
  checked,
  onChange,
  label,
  sub,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  sub?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-3 ${disabled ? "opacity-50" : "cursor-pointer"} select-none`}>
      {(label || sub) && (
        <span className="flex-1 min-w-0">
          {label && <span className="block text-sm font-bold">{label}</span>}
          {sub && <span className="block text-xs text-muted mt-0.5 leading-relaxed">{sub}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-[52px] h-8 rounded-full transition-colors ${checked ? "bg-money" : "bg-line-strong"}`}
      >
        <span
          className="absolute top-1 w-6 h-6 rounded-full bg-[#fff] shadow transition-all"
          style={{ insetInlineStart: checked ? 24 : 4 }}
        />
      </button>
    </label>
  );
}

/** Pill segmented control (period pickers, tabs). Black pill = selected. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className = "",
  fill = false,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  size?: "sm" | "md";
  className?: string;
  /** Stretch to the container and give every option equal width. */
  fill?: boolean;
}) {
  return (
    <div className={`${fill ? "flex w-full" : "inline-flex max-w-full overflow-x-auto scroll-x [scrollbar-width:none]"} gap-1 bg-surface-2 rounded-full p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`${size === "sm" ? "px-3 h-8 text-xs" : "px-4 h-9 text-sm"} ${fill ? "flex-1 px-1" : ""} rounded-full font-bold whitespace-nowrap transition-colors ${
            value === o.value ? "bg-ink text-background" : "text-ink-500 hover:bg-paper"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  title,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "brand" | "ink";
  title?: string;
}) {
  const tones = {
    neutral: "bg-surface-2 text-ink-500",
    good: "bg-money-soft text-money",
    warn: "bg-warn-soft text-warn-ink",
    bad: "bg-loss-soft text-loss",
    brand: "bg-ink text-background",
    ink: "bg-ink text-background",
  }[tone];
  return (
    <span title={title} className={`inline-flex items-center gap-1 text-xs font-bold rounded-full px-2.5 py-1 ${tones}`}>
      {children}
    </span>
  );
}

/** Week-over-week change chip: green up / red down, with an arrow — never colour alone. */
export function Delta({ value, fmt, invert = false, suffix = "" }: { value: number | null | undefined; fmt?: (n: number) => string; invert?: boolean; suffix?: string }) {
  if (value == null || !Number.isFinite(value) || Math.abs(value) < 0.005) return <span className="text-xs text-muted-2">—</span>;
  const good = invert ? value < 0 : value > 0;
  const text = `${value > 0 ? "+" : "−"}${fmt ? fmt(Math.abs(value)) : Math.abs(value)}${suffix}`;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-bold tnum ${good ? "text-money" : "text-loss"}`}>
      <Icon name={value > 0 ? "arrowUp" : "arrowDown"} size={12} strokeWidth={2.5} />
      {text}
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-center text-muted py-10 text-sm leading-relaxed">{children}</div>;
}

/** Big headline figure, Uber earnings-screen style. */
export function Hero({
  label,
  value,
  sub,
  tone = "ink",
  right,
  size = "lg",
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  tone?: "ink" | "money" | "loss";
  right?: React.ReactNode;
  size?: "lg" | "xl";
}) {
  // "ink" inherits, so the figure is black on a tile and white on a black card
  const color = { ink: "text-current", money: "text-money", loss: "text-loss" }[tone];
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs font-bold opacity-60 uppercase tracking-wide">{label}</div>
        <div className={`${size === "xl" ? "text-[44px] md:text-[52px]" : "text-[34px] md:text-[40px]"} font-bold display leading-none mt-1.5 ${color}`}>
          {value}
        </div>
        {sub && <div className="text-sm text-muted mt-2 leading-relaxed">{sub}</div>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

/** Stat tile: label, value, optional sub-line and delta. */
export function Tile({
  label,
  value,
  sub,
  delta,
  tone = "tile",
  icon,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  delta?: React.ReactNode;
  tone?: "tile" | "outline" | "ink" | "money" | "loss" | "warn";
  icon?: IconName;
  className?: string;
}) {
  const inv = tone === "ink";
  return (
    <Card tone={tone} className={`!p-3.5 md:!p-4 ${className}`}>
      <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide ${inv ? "text-hero-fg/60" : "text-muted"}`}>
        {icon && <Icon name={icon} size={13} />}
        <span className="truncate">{label}</span>
      </div>
      <div className={`text-[22px] md:text-2xl font-bold display mt-1 leading-tight ${inv ? "text-hero-fg" : ""}`}>{value}</div>
      {(sub || delta) && (
        <div className={`flex items-center gap-2 mt-1 text-xs ${inv ? "text-hero-fg/60" : "text-muted"}`}>
          {delta}
          {sub && <span className="truncate">{sub}</span>}
        </div>
      )}
    </Card>
  );
}

/** Uber-style list row: icon, title/sub, value, chevron. Button or link body. */
export function ListRow({
  icon,
  emoji,
  title,
  sub,
  value,
  valueSub,
  onClick,
  href,
  chevron = !!(onClick || href),
  tone = "default",
  right,
}: {
  icon?: IconName;
  emoji?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  value?: React.ReactNode;
  valueSub?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  chevron?: boolean;
  tone?: "default" | "good" | "bad" | "warn";
  right?: React.ReactNode;
}) {
  const valueColor = { default: "text-ink", good: "text-money", bad: "text-loss", warn: "text-warn-ink" }[tone];
  const body = (
    <>
      {(icon || emoji) && (
        <span className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center shrink-0 text-ink">
          {icon ? <Icon name={icon} size={20} /> : <span className="text-lg leading-none">{emoji}</span>}
        </span>
      )}
      <span className="flex-1 min-w-0 text-start">
        <span className="block text-[15px] font-bold truncate">{title}</span>
        {sub && <span className="block text-xs text-muted mt-0.5 truncate">{sub}</span>}
      </span>
      {(value != null || valueSub != null) && (
        <span className="text-end shrink-0">
          {value != null && <span className={`block text-[15px] font-bold tnum ${valueColor}`}>{value}</span>}
          {valueSub != null && <span className="block text-xs text-muted mt-0.5">{valueSub}</span>}
        </span>
      )}
      {right}
      {chevron && <Icon name="chevron" size={18} className="text-muted-2 rtl:rotate-180" />}
    </>
  );
  const cls = "flex items-center gap-3 w-full py-3 min-h-14 text-ink";
  if (href) {
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    return (
      <a href={href} className={`${cls} hover:bg-surface-2/60 -mx-2 px-2 rounded-xl transition-colors`}>
        {body}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cls} hover:bg-surface-2/60 -mx-2 px-2 rounded-xl transition-colors`}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
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
        <Btn onClick={() => toggle(true)}>
          <Icon name="plus" size={18} strokeWidth={2.25} /> {buttonLabel}
        </Btn>
      ) : (
        <Card tone="outline" className="animate-pop-in">
          <div className="flex justify-between items-center mb-4">
            <span className="font-bold text-[15px]">{buttonLabel}</span>
            <IconButton name="close" onClick={() => toggle(false)} />
          </div>
          {children}
        </Card>
      )}
    </div>
  );
}

export function IconButton({ name, onClick, label, className = "", size = 20 }: { name: IconName; onClick?: () => void; label?: string; className?: string; size?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`w-10 h-10 rounded-full flex items-center justify-center text-ink hover:bg-surface-2 active:bg-line transition-colors ${className}`}
    >
      <Icon name={name} size={size} />
    </button>
  );
}

/**
 * Bottom sheet on phones, centred dialog on desktop. Used for every edit
 * form so a wide list can never clip it.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
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
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative bg-paper text-ink w-full ${wide ? "md:max-w-3xl" : "md:max-w-xl"} max-h-[94vh] flex flex-col
                    rounded-t-3xl md:rounded-2xl shadow-[var(--shadow-lg)] animate-sheet-in`}
      >
        <div className="md:hidden flex justify-center pt-2.5">
          <span className="w-10 h-1 rounded-full bg-line-strong" />
        </div>
        <div className="px-4 md:px-5 pt-3 pb-3 flex items-center justify-between">
          <h3 className="font-bold text-lg tracking-tight">{title}</h3>
          <IconButton name="close" onClick={onClose} label="Close" />
        </div>
        <div className="px-4 md:px-5 pb-4 md:pb-5 overflow-y-auto flex-1 safe-bottom">{children}</div>
        {footer && <div className="px-4 md:px-5 py-3 border-t border-line bg-paper rounded-b-2xl safe-bottom">{footer}</div>}
      </div>
    </div>
  );
}

export const Sheet = Modal;

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
    <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-line">
      <Btn variant="secondary" size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1}>
        <Icon name="back" size={16} className="rtl:rotate-180" /> {labelPrev}
      </Btn>
      <span className="text-xs text-muted tnum">{labelPage}</span>
      <Btn variant="secondary" size="sm" onClick={() => onPage(page + 1)} disabled={page >= totalPages}>
        {labelNext} <Icon name="chevron" size={16} className="rtl:rotate-180" />
      </Btn>
    </div>
  );
}

/** One logged record as a card (a trip carries 16+ fields — no table fits a phone). */
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
    plain: "bg-paper border-line",
    warn: "bg-warn-soft border-warn/60",
  }[tone];
  return <div className={`rounded-xl border ${tones} px-3.5 py-3 ${className}`}>{children}</div>;
}

/** A labelled value inside a RecordCard. */
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
    default: "text-ink",
    muted: "text-muted-2",
    good: "text-money",
    warn: "text-warn-ink",
    bad: "text-loss",
  }[tone];
  return (
    <div className="min-w-0" title={title}>
      <div className="text-[10px] uppercase tracking-wide text-muted font-bold truncate">{label}</div>
      <div className={`text-sm font-bold tnum truncate ${tones}`}>{value}</div>
    </div>
  );
}

export function StatGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: 3 | 4 | 5 | 6 }) {
  const colCls = {
    3: "grid-cols-2 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
    6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
  }[cols];
  return <div className={`grid ${colCls} gap-x-4 gap-y-2.5 mt-2.5`}>{children}</div>;
}

/** Collapsible group header (a shift, a day) above its record cards. */
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
    plain: "bg-surface hover:bg-surface-2",
    warn: "bg-warn-soft hover:brightness-[0.98]",
  }[tone];
  return (
    <button onClick={onToggle} className={`w-full flex items-center gap-2.5 rounded-xl px-3.5 min-h-12 py-2.5 text-start transition-colors ${tones}`}>
      <Icon name="chevron" size={16} className={`text-muted transition-transform shrink-0 rtl:rotate-180 ${open ? "rotate-90 rtl:rotate-90" : ""}`} />
      <span className="font-bold text-sm truncate">{title}</span>
      {meta && <span className="text-xs text-muted truncate hidden sm:inline">{meta}</span>}
      {right && <span className="ms-auto shrink-0">{right}</span>}
    </button>
  );
}

const METER_TONES = {
  good: "var(--money)",
  warn: "var(--warn)",
  bad: "var(--loss)",
  brand: "var(--ink)",
  neutral: "var(--muted-2)",
} as const;

export type MeterTone = keyof typeof METER_TONES;

/** Horizontal progress meter — "how much of this is used up". Uncapped ratio. */
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
  marker?: { ratio: number; label?: string };
}) {
  const filled = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const markAt = marker && Number.isFinite(marker.ratio) ? Math.max(0, Math.min(1, marker.ratio)) : null;
  return (
    <div>
      {(label || value) && (
        <div className="flex items-baseline justify-between gap-2 mb-1">
          {label && <span className="text-xs font-bold text-ink-500 truncate">{label}</span>}
          {value && <span className="text-xs font-bold tnum whitespace-nowrap">{value}</span>}
        </div>
      )}
      <div className={`relative ${thin ? "h-1.5" : "h-2.5"} rounded-full bg-line overflow-hidden`}>
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${filled * 100}%`, background: METER_TONES[tone] }} />
        {markAt != null && (
          <span title={marker!.label} className="absolute top-0 bottom-0 w-0.5 bg-ink/70 rounded-full" style={{ insetInlineStart: `calc(${markAt * 100}% - 1px)` }} />
        )}
      </div>
      {markAt != null && marker!.label && (
        <div className="flex mt-0.5 text-[10px] text-muted">
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
      {sub && <div className="text-[11px] text-muted mt-1 leading-relaxed">{sub}</div>}
    </div>
  );
}

export type MeterSegment = { key: string; value: number; color: string; label: string };

/** Proportional bar: several parts of one honest total, 2px surface gaps. */
export function StackedMeter({ segments, height = 10 }: { segments: MeterSegment[]; height?: number }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  if (total <= 0) return null;
  return (
    <div className="flex rounded-full overflow-hidden bg-line" style={{ gap: 2, height }}>
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <div key={s.key} title={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
        ))}
    </div>
  );
}

const GAUGE_ARC_LENGTH = Math.PI * 68;

/** Half-circle gauge for a value with a real ceiling. */
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
          <path d="M 12 80 A 68 68 0 0 1 148 80" fill="none" stroke="var(--line)" strokeWidth={12} strokeLinecap="round" />
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
          <div className="text-2xl font-bold display leading-none">{value}</div>
          {unit && <div className="text-[10px] font-bold text-muted mt-0.5">{unit}</div>}
        </div>
      </div>
      {(minLabel || maxLabel) && (
        <div className="flex justify-between w-[160px] -mt-1 text-[10px] text-muted-2 tnum">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
      {caption && <div className="text-[11px] text-muted mt-1 text-center leading-relaxed">{caption}</div>}
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="scroll-x -mx-4 md:-mx-5 px-4 md:px-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-start text-xs text-muted border-b border-line">
            {head.map((h, i) => (
              <th key={i} className="text-start py-2.5 px-2 font-bold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

/** Inline-editable number: tap to edit, blur/Enter to save. */
export function EditableNum({
  value,
  onSave,
  fmt,
  placeholder = "—",
  className = "",
}: {
  value: number | null | undefined;
  onSave: (n: number | null) => void;
  fmt: (n: number) => string;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value != null ? String(value) : "");
          setEditing(true);
        }}
        className={`text-start hover:bg-surface-2 rounded-lg px-1.5 -mx-1.5 min-h-8 ${className}`}
      >
        {value ? fmt(value) : <span className="text-muted-2">{placeholder}</span>}
      </button>
    );
  }
  const commit = () => {
    setEditing(false);
    const n = draft.trim() === "" ? null : Number(draft);
    if (n !== value) onSave(n != null && Number.isFinite(n) ? n : null);
  };
  return (
    <input
      type="number"
      step="0.1"
      inputMode="decimal"
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      className="w-20 rounded-lg border border-ink px-1.5 h-8 text-sm bg-paper"
    />
  );
}
