// Parser for OCR text of the Uber Driver app "Earnings Activity" screen.
// Tolerant of OCR noise: works line-by-line with loose regexes. Pure — no DB.

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

const DAY_HEADER_RE =
  /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[,.]?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[,.]?\s+(\d{1,2})/;
// EGP with common OCR confusions of the letters
const CURRENCY = "(?:EGP|ECP|EGF|E6P|£GP)";
const EARNINGS_RE = new RegExp(`${CURRENCY}\\s*([\\d,]+[.,]\\d{2})`, "i");
const TIME_RE = /(\d{1,2}):(\d{2})\s*(AM|PM)/i;
const DETAIL_RE = /(\d+)\s*min(?:\s*(\d+)\s*sec)?\s*[·.\-•]?\s*([\d.]+)\s*km/i;
const CASH_RE = new RegExp(`${CURRENCY}\\s*([\\d,]+[.,]\\d{2})\\s*Cash\\s*Collected`, "i");
// Google place labels under each card end with the country code
const ADDRESS_RE = /^[©@oO0¢€&\-·.\s]*(.+?\s(?:EG|AE|SA))\s*$/;

export type ActivityTrip = {
  date: string | null; // yyyy-mm-dd, null when no day header seen yet
  time: string | null; // HH:mm (24h)
  earnings: number; // NaN = orphan card whose amount line the OCR missed
  cashCollected: number | null;
  product: string | null;
  durationMin: number | null;
  distanceKm: number | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
};

function money(s: string): number {
  return Number(s.replace(/,/g, m => (m === "," && s.indexOf(".") === -1 ? "." : "")).replace(/,/g, ""));
}

function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Snap OCR'd product noise ("id Comfort", "Uberx Priority") to known names. */
export function normalizeProduct(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (/business/.test(s)) return "Business Comfort";
  if (/comfort/.test(s)) return "Comfort";
  if (/saver/.test(s)) return "UberX Saver";
  if (/priorit/.test(s)) return "UberX Priority";
  if (/xl\b/.test(s)) return "UberXL";
  if (/uber\s*x/.test(s)) return "UberX";
  if (/scooter/.test(s)) return "Scooter";
  const cleaned = raw.replace(/^(?:[^A-Za-z]+|[A-Za-z]\s+)+/, "").trim();
  return cleaned.length >= 3 ? cleaned : null;
}

export function parseEarningsActivityText(text: string, refYear: number): ActivityTrip[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const trips: ActivityTrip[] = [];
  let currentDate: string | null = null;
  let current: ActivityTrip | null = null;

  const newTrip = (earnings: number): ActivityTrip => ({
    date: currentDate,
    time: null,
    earnings,
    cashCollected: null,
    product: null,
    durationMin: null,
    distanceKm: null,
    pickupAddress: null,
    dropoffAddress: null,
  });

  const flush = () => {
    // a card is a real trip only once we saw its detail line (dedupes the
    // "Cash Collected" amounts and map-label noise that also contain EGP)
    if (current && current.durationMin != null) trips.push(current);
    current = null;
  };

  for (const line of lines) {
    const day = line.match(DAY_HEADER_RE);
    if (day && !CASH_RE.test(line)) {
      flush();
      currentDate = iso(new Date(refYear, MONTHS[day[1]], Number(day[2])));
      continue;
    }

    const cash = line.match(CASH_RE);
    if (cash && current && current.cashCollected == null) {
      current.cashCollected = money(cash[1]);
      continue;
    }

    const detail = line.match(DETAIL_RE);
    if (detail) {
      // a second detail line means the OCR missed the next card's amount
      // line — never overwrite a completed card, surface an orphan instead
      if (!current || current.durationMin != null) {
        flush();
        current = newTrip(NaN);
      }
      current.durationMin = Number(detail[1]);
      current.distanceKm = Number(detail[3]);
      const beforeMin = line
        .slice(0, line.search(/\d+\s*min/))
        .replace(/[·.\-•|]+\s*$/, "")
        .trim();
      current.product = normalizeProduct(beforeMin) ?? current.product;
      continue;
    }

    const earn = line.match(EARNINGS_RE);
    if (earn && !CASH_RE.test(line)) {
      flush();
      current = newTrip(money(earn[1]));
      const tm = line.match(TIME_RE);
      if (tm) {
        let h = Number(tm[1]) % 12;
        if (tm[3].toUpperCase() === "PM") h += 12;
        current.time = `${String(h).padStart(2, "0")}:${tm[2]}`;
      }
      continue;
    }

    // pickup/dropoff labels sit under the map of the card being parsed
    const addr = line.match(ADDRESS_RE);
    if (addr && current && current.durationMin != null) {
      if (!current.pickupAddress) current.pickupAddress = addr[1];
      else if (!current.dropoffAddress) current.dropoffAddress = addr[1];
      continue;
    }

    // time sometimes lands on its own line right after the amount
    const tm = line.match(TIME_RE);
    if (tm && current && current.time == null) {
      let h = Number(tm[1]) % 12;
      if (tm[3].toUpperCase() === "PM") h += 12;
      current.time = `${String(h).padStart(2, "0")}:${tm[2]}`;
    }
  }
  flush();

  // overlapping scroll screenshots produce duplicate cards — keep the first
  const seen = new Set<string>();
  return trips.filter((t) => {
    const key = `${t.time ?? "?"}|${Number.isFinite(t.earnings) ? t.earnings : "?"}|${t.distanceKm ?? "?"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
