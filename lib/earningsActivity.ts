// Parser for OCR text of the Uber Driver app "Earnings Activity" screen.
// Tolerant of OCR noise: works line-by-line with loose regexes. Pure — no DB.

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

const DAY_HEADER_RE =
  /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[,.]?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[,.]?\s+(\d{1,2})/;
const EARNINGS_RE = /EGP\s*([\d,]+[.,]\d{2})/i;
const TIME_RE = /(\d{1,2}):(\d{2})\s*(AM|PM)/i;
const DETAIL_RE = /(\d+)\s*min(?:\s*(\d+)\s*sec)?\s*[·.\-•]?\s*([\d.]+)\s*km/i;
const CASH_RE = /EGP\s*([\d,]+[.,]\d{2})\s*Cash\s*Collected/i;

export type ActivityTrip = {
  date: string | null; // yyyy-mm-dd, null when no day header seen yet
  time: string | null; // HH:mm (24h)
  earnings: number;
  cashCollected: number | null;
  product: string | null;
  durationMin: number | null;
  distanceKm: number | null;
};

function money(s: string): number {
  return Number(s.replace(/,/g, m => (m === "," && s.indexOf(".") === -1 ? "." : "")).replace(/,/g, ""));
}

function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseEarningsActivityText(text: string, refYear: number): ActivityTrip[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const trips: ActivityTrip[] = [];
  let currentDate: string | null = null;
  let current: ActivityTrip | null = null;

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
    if (cash && current) {
      current.cashCollected = money(cash[1]);
      continue;
    }

    const detail = line.match(DETAIL_RE);
    if (detail && current) {
      current.durationMin = Number(detail[1]);
      current.distanceKm = Number(detail[3]);
      const beforeMin = line
        .slice(0, line.search(/\d+\s*min/))
        .replace(/[·.\-•|]+\s*$/, "")
        .replace(/^(?:[^A-Za-z]+|[A-Za-z]\s+)+/, "") // OCR noise from the avatar icon
        .trim();
      if (beforeMin.length >= 3) current.product = beforeMin;
      continue;
    }

    const earn = line.match(EARNINGS_RE);
    if (earn && !CASH_RE.test(line)) {
      flush();
      current = {
        date: currentDate,
        time: null,
        earnings: money(earn[1]),
        cashCollected: null,
        product: null,
        durationMin: null,
        distanceKm: null,
      };
      const tm = line.match(TIME_RE);
      if (tm) {
        let h = Number(tm[1]) % 12;
        if (tm[3].toUpperCase() === "PM") h += 12;
        current.time = `${String(h).padStart(2, "0")}:${tm[2]}`;
      }
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
  return trips;
}
