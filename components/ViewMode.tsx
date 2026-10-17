"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useI18n } from "./I18nProvider";
import { Icon } from "./icons";

/**
 * Simple vs detailed analysis. Simple (the default) shows the handful of
 * numbers a driver acts on; detailed adds every breakdown. Saved per device.
 */
export type ViewMode = "simple" | "detailed";

const Ctx = createContext<{ mode: ViewMode; setMode: (m: ViewMode) => void }>({ mode: "simple", setMode: () => {} });

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>("simple");
  useEffect(() => {
    try {
      const v = localStorage.getItem("viewMode");
      if (v === "simple" || v === "detailed") setModeState(v);
    } catch {}
  }, []);
  const setMode = (m: ViewMode) => {
    setModeState(m);
    try {
      localStorage.setItem("viewMode", m);
    } catch {}
  };
  return <Ctx.Provider value={{ mode, setMode }}>{children}</Ctx.Provider>;
}

export const useViewMode = () => useContext(Ctx);

/** Renders its children only in detailed mode. */
export function Detailed({ children }: { children: React.ReactNode }) {
  return useViewMode().mode === "detailed" ? <>{children}</> : null;
}

/** Renders its children only in simple mode. */
export function SimpleOnly({ children }: { children: React.ReactNode }) {
  return useViewMode().mode === "simple" ? <>{children}</> : null;
}

/** The Simple | Detailed switch shown at the top of analysis screens. */
export function ViewModeToggle({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const { mode, setMode } = useViewMode();
  return (
    <div role="radiogroup" aria-label={t("vm.label")} className={`inline-flex items-center gap-0.5 rounded-full bg-sheet border border-line p-1 shadow-[var(--shadow-sm)] ${className}`}>
      {(["simple", "detailed"] as const).map((m) => {
        const on = mode === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setMode(m)}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold transition-colors ${on ? "bg-action text-action-fg shadow-[var(--shadow-btn)]" : "text-ink-500 hover:text-ink"}`}
          >
            <Icon name={m === "simple" ? "sparkle" : "chart"} size={14} strokeWidth={2.2} />
            {t(`vm.${m}`)}
          </button>
        );
      })}
    </div>
  );
}

/** Bottom-of-page nudge from simple to detailed. */
export function MoreDetailsButton() {
  const { t } = useI18n();
  const { mode, setMode } = useViewMode();
  if (mode !== "simple") return null;
  return (
    <button
      type="button"
      onClick={() => {
        setMode("detailed");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className="w-full rounded-2xl border-2 border-dashed border-line-strong text-ink-500 hover:border-action hover:text-action h-14 text-sm font-bold flex items-center justify-center gap-2 transition-colors"
    >
      <Icon name="chart" size={18} /> {t("vm.showDetailed")}
    </button>
  );
}
