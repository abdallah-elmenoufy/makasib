"use client";
import { createContext, useContext } from "react";
import { Locale, translate } from "@/lib/i18n/messages";

const Ctx = createContext<{ locale: Locale }>({ locale: "en" });

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <Ctx.Provider value={{ locale }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const { locale } = useContext(Ctx);
  return {
    locale,
    dir: locale === "ar" ? "rtl" : ("ltr" as "rtl" | "ltr"),
    t: (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
  };
}
