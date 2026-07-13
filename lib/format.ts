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
