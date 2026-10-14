export function fmtMoney(amount: number, locale = "en", currency = "EGP"): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function fmtNum(n: number, locale = "en", digits = 1): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", {
    maximumFractionDigits: digits,
  }).format(n);
}

export function fmtDate(d: Date | string, locale = "en"): string {
  return new Date(d).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(d: Date | string, locale = "en"): string {
  return new Date(d).toLocaleString(locale === "ar" ? "ar-EG" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** For <input type="datetime-local"> values, in local time. */
export function toLocalInput(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function hoursBetween(a: Date | string, b: Date | string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;
}

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Western digits → Arabic-Indic when the UI is Arabic; untouched otherwise.
 *  For text that already carries digits (a clock, a count, a date label). */
export function localizeDigits(s: string | number, locale = "en"): string {
  const str = String(s);
  if (locale !== "ar") return str;
  return str.replace(/[0-9]/g, (d) => ARABIC_DIGITS[Number(d)]);
}

/** Whole number in the UI's digits. */
export function fmtInt(n: number, locale = "en"): string {
  return fmtNum(n, locale, 0);
}

/** "14:00" style hour label in the UI's digits. */
export function fmtHour(h: number, locale = "en", minutes = 0): string {
  const hh = String(((h % 24) + 24) % 24).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return localizeDigits(`${hh}:${mm}`, locale);
}

/** "14:00–15:00" */
export function fmtHourRange(h: number, locale = "en"): string {
  return `${fmtHour(h, locale)}–${fmtHour(h + 1, locale)}`;
}

/**
 * Inline separator between facts ("28 trips · 35h"). Arabic gets the Arabic
 * comma: a middle dot sits at the height of the Arabic zero (٠), so "· ٢٦"
 * reads as "٢٦٠".
 */
export function sep(locale = "en"): string {
  return locale === "ar" ? "، " : " · ";
}
