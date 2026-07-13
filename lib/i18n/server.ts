import "server-only";
import { cookies } from "next/headers";
import { Locale, LOCALES, translate } from "./messages";

export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get("locale")?.value as Locale | undefined;
  return c && LOCALES.includes(c) ? c : "en";
}

export async function getT() {
  const locale = await getLocale();
  return {
    locale,
    dir: locale === "ar" ? "rtl" : ("ltr" as "rtl" | "ltr"),
    t: (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
  };
}
