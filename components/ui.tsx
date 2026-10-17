"use client";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "./icons";

/* ---------------------------------------------------------------------------
   Primitives — Makasib v2. White cards with soft shadows on a green-grey
   page, a brand-gradient hero, tinted icon chips per topic, green buttons,
   and big Readex Pro numerals. Tokens live in app/globals.css.
--------------------------------------------------------------------------- */

/** Which colour chip a card icon gets — one hue per topic, everywhere. */
export const ICON_TINT: Partial<Record<IconName, string>> = {
  calendar: "tint-sky",
  clock: "tint-sky",
  timer: "tint-sky",
  map: "tint-sky",
  road: "tint-violet",
  wrench: "tint-violet",
  download: "tint-violet",
  camera: "tint-violet",
  wallet: "tint-green",
  chart: "tint-green",
  car: "tint-green",
  flag: "tint-green",
  trophy: "tint-amber",
  fuel: "tint-amber",
  bolt: "tint-amber",
  bell: "tint-amber",
  pin: "tint-rose",
  receipt: "tint-rose",
  sparkle: "tint-green",
  info: "tint-slate",
  settings: "tint-slate",
};

/** A rounded square in a topic colour holding an icon or an emoji. */
export function IconChip({ icon, tint, size = "md", className = "" }: { icon: string | IconName; tint?: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const isIcon = /^[a-zA-Z]+$/.test(icon);
  const dims = { sm: "w-7 h-7 rounded-lg", md: "w-9 h-9 rounded-xl", lg: "w-11 h-11 rounded-2xl" }[size];
  const iconSize = { sm: 15, md: 18, lg: 22 }[size];
  const cls = tint ?? (isIcon ? ICON_TINT[icon as IconName] ?? "tint-slate" : "tint-slate");
  return (
    <span className={`${dims} ${cls} flex items-center justify-center shrink-0 ${className}`}>
      {isIcon ? <Icon name={icon as IconName} size={iconSize} strokeWidth={2.1} /> : <span className="text-base leading-none">{icon}</span>}
    </span>
  );
}

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
    tile: "bg-sheet border border-line/70 shadow-[var(--shadow-card)]",
    outline: "bg-sheet border border-line",
    ink: "hero-surface",
    money: "bg-money-soft border border-money/15",
    loss: "bg-loss-soft border border-loss/15",
    warn: "bg-warn-soft border border-warn/30",
  }[tone];
  return <div className={`rounded-[22px] ${tones} ${padded ? "p-4 md:p-5" : ""} ${className}`}>{children}</div>;
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
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0 flex items-start gap-3">
        {icon && <IconChip icon={icon} />}
        <div className="min-w-0 pt-0.5">
          <h2 className="text-[17px] font-bold tracking-tight leading-snug">{title}</h2>
          {sub && <p className="text-xs text-muted mt-0.5 leading-relaxed">{sub}</p>}
        </div>
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
        <h1 className="text-[30px] md:text-[36px] font-bold tracking-tight leading-tight display">{children}</h1>
        {sub && <p className="text-sm text-muted mt-1">{sub}</p>}
      </div>
      {actions && <div className="max-w-full flex items-center gap-2 flex-wrap">{actions}</div>}
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
  const sizes = size === "sm" ? "px-3.5 h-9 text-[13px]" : "px-5 h-12 text-[15px]";
  const styles = {
    primary: `bg-action hover:bg-action-700 active:bg-action-700 text-action-fg shadow-[var(--shadow-btn)] ${sizes}`,
    secondary: `bg-sheet border border-line hover:bg-surface-2 active:bg-line text-ink ${sizes}`,
    danger: `bg-sheet hover:bg-loss-soft text-loss border border-line ${sizes}`,
    ghost: `bg-transparent hover:bg-surface-2 text-ink-500 ${sizes}`,
    money: `bg-money hover:brightness-95 text-white ${sizes}`,
    big: "brand-gradient hover:brightness-105 text-white shadow-[var(--shadow-btn)] px-6 h-16 text-lg w-full !rounded-2xl",
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
  "w-full rounded-xl bg-paper border border-line/60 px-3.5 h-12 text-base text-ink placeholder:text-muted-2 " +
  "focus:outline-none focus:bg-sheet focus:border-action focus:ring-2 focus:ring-action/15 transition-colors";

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
        className={`relative shrink-0 w-[52px] h-8 rounded-full transition-colors ${checked ? "bg-action" : "bg-line-strong"}`}
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
    <div className={`${fill ? "flex w-full" : "inline-flex max-w-full overflow-x-auto scroll-x [scrollbar-width:none]"} gap-1 bg-sheet border border-line rounded-full p-1 shadow-[var(--shadow-sm)] ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`${size === "sm" ? "px-3 h-8 text-xs" : "px-4 h-9 text-sm"} ${fill ? "flex-1 px-1" : ""} rounded-full font-bold whitespace-nowrap transition-colors ${
            value === o.value ? "bg-action text-action-fg shadow-[var(--shadow-btn)]" : "text-ink-500 hover:text-ink hover:bg-surface-2"
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
    brand: "brand-gradient text-white",
    ink: "brand-gradient text-white",
  }[tone];
  return (
    <span title={title} className={`badge inline-flex items-center gap-1 text-xs font-bold rounded-full px-2.5 py-1 ${tones}`}>
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
    <span className={`delta-pill ${good ? "is-up bg-money-soft text-money" : "is-down bg-loss-soft text-loss"} inline-flex items-center gap-0.5 text-xs font-bold tnum rounded-full px-2 py-0.5`}>
      <Icon name={value > 0 ? "arrowUp" : "arrowDown"} size={12} strokeWidth={2.6} />
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
        <div className="text-sm font-bold opacity-75">{label}</div>
        <div className={`${size === "xl" ? "text-[52px] md:text-[64px]" : "text-[40px] md:text-[48px]"} font-bold display leading-[1.02] mt-2 ${color}`}>
          {value}
        </div>
        {sub && <div className="text-sm text-muted mt-2.5 leading-relaxed">{sub}</div>}
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
    <Card tone={tone} className={`!p-4 md:!p-5 ${className}`}>
      <div className={`flex items-center gap-2 text-[13px] font-bold ${inv ? "text-hero-fg/70" : "text-ink-500"}`}>
        {icon && <IconChip icon={icon} size="sm" />}
        <span className="truncate">{label}</span>
      </div>
      <div className={`text-[28px] md:text-[32px] font-bold display mt-2 leading-none truncate ${inv ? "text-hero-fg" : ""}`}>{value}</div>
      {(sub || delta) && (
        <div className={`flex items-center gap-2 mt-2 text-xs ${inv ? "text-hero-fg/70" : "text-muted"}`}>
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
        <IconChip icon={icon ?? emoji ?? ""} size="lg" />
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
        className={`relative bg-sheet text-ink w-full ${wide ? "md:max-w-3xl" : "md:max-w-xl"} max-h-[94vh] flex flex-col
                    rounded-t-[28px] md:rounded-[24px] shadow-[var(--shadow-lg)] animate-sheet-in`}
      >
        <div className="md:hidden flex justify-center pt-2.5">
          <span className="w-10 h-1 rounded-full bg-line-strong" />
        </div>
        <div className="px-4 md:px-5 pt-3 pb-3 flex items-center justify-between">
          <h3 className="font-bold text-xl tracking-tight">{title}</h3>
          <IconButton name="close" onClick={onClose} label="Close" />
        </div>
        <div className="px-4 md:px-5 pb-4 md:pb-5 overflow-y-auto flex-1 safe-bottom">{children}</div>
        {footer && <div className="px-4 md:px-5 py-3 border-t border-line bg-sheet rounded-b-2xl safe-bottom">{footer}</div>}
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
    plain: "bg-sheet border-line shadow-[var(--shadow-sm)]",
    warn: "bg-warn-soft border-warn/60",
  }[tone];
  return <div className={`rounded-2xl border ${tones} px-4 py-3.5 ${className}`}>{children}</div>;
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
      <div className="text-[11px] text-muted font-bold truncate">{label}</div>
      <div className={`text-[17px] font-bold tnum truncate mt-0.5 ${tones}`}>{value}</div>
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
  return <div className={`grid ${colCls} gap-x-4 gap-y-3 mt-3 pt-3 border-t border-line`}>{children}</div>;
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
    plain: "bg-paper hover:bg-surface-2",
    warn: "bg-warn-soft hover:brightness-[0.98]",
  }[tone];
  return (
    <button onClick={onToggle} className={`w-full flex items-center gap-2.5 rounded-2xl px-4 min-h-14 py-3 text-start transition-colors ${tones}`}>
      <Icon name="chevron" size={16} className={`text-muted transition-transform shrink-0 rtl:rotate-180 ${open ? "rotate-90 rtl:rotate-90" : ""}`} />
      <span className="font-bold text-[15px] truncate">{title}</span>
      {meta && <span className="text-xs text-muted truncate hidden sm:inline">{meta}</span>}
      {right && <span className="ms-auto shrink-0">{right}</span>}
    </button>
  );
}

const METER_TONES = {
  good: "var(--money)",
  warn: "var(--warn)",
  bad: "var(--loss)",
  brand: "var(--action)",
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
          {label && <span className="text-[13px] font-bold text-ink-500 truncate">{label}</span>}
          {value && <span className="text-[13px] font-bold tnum whitespace-nowrap">{value}</span>}
        </div>
      )}
      <div className={`relative ${thin ? "h-2" : "h-3"} rounded-full overflow-hidden`} style={{ background: `color-mix(in srgb, ${METER_TONES[tone]} 16%, var(--surface-2))` }}>
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
export function StackedMeter({ segments, height = 12 }: { segments: MeterSegment[]; height?: number }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  if (total <= 0) return null;
  return (
    <div className="flex rounded-full overflow-hidden" style={{ gap: 2, height }}>
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
      <div className="relative w-[180px]">
        <svg viewBox="0 0 160 92" className="w-full" role="img" aria-label={caption ?? value}>
          <path d="M 12 80 A 68 68 0 0 1 148 80" fill="none" stroke={`color-mix(in srgb, ${METER_TONES[tone]} 16%, var(--surface-2))`} strokeWidth={14} strokeLinecap="round" />
          <path
            d="M 12 80 A 68 68 0 0 1 148 80"
            fill="none"
            stroke={METER_TONES[tone]}
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={GAUGE_ARC_LENGTH}
            strokeDashoffset={GAUGE_ARC_LENGTH * (1 - filled)}
            style={{ transition: "stroke-dashoffset 600ms ease" }}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-1 text-center">
          <div className="text-[32px] font-bold display leading-none">{value}</div>
          {unit && <div className="text-[10px] font-bold text-muted mt-0.5">{unit}</div>}
        </div>
      </div>
      {(minLabel || maxLabel) && (
        <div className="flex justify-between w-[180px] -mt-1 text-[10px] text-muted-2 tnum">
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
      <table className="tbl w-full text-[15px]">
        <thead>
          <tr className="text-start text-xs text-ink-500">
            {head.map((h, i) => (
              <th key={i} className="text-start py-2.5 px-3 font-bold whitespace-nowrap bg-paper first:rounded-s-xl last:rounded-e-xl">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
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
      className="w-20 rounded-lg border border-action px-1.5 h-8 text-sm bg-sheet"
    />
  );
}
