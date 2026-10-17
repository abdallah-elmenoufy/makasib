"use client";
import { useEffect, useRef } from "react";

/**
 * A tiny in-page change bus. Anything that writes data (the drive sheet,
 * useCrud, quick-add forms) announces it; every screen that shows data
 * re-fetches. This is what lets the drive sheet live outside the pages and
 * still keep the dashboard, shifts and trips lists current.
 */
const EVENT = "makasib:changed";

export function emitChanged(source?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { source: source ?? null } }));
}

/** Run `fn` whenever data changes elsewhere. `self` skips this caller's own announcements. */
export function useOnChanged(fn: () => void, self?: string) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const h = (e: Event) => {
      const src = (e as CustomEvent).detail?.source;
      if (self && src === self) return;
      ref.current();
    };
    window.addEventListener(EVENT, h);
    return () => window.removeEventListener(EVENT, h);
  }, [self]);
}
