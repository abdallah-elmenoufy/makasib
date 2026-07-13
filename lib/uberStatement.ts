// Parser for Uber weekly statement PDFs (drivers.uber.com → Documents).
// Works on the text layer extracted by pdf-parse. Pure functions — no DB.

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

const DAY_RE = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), ([A-Z][a-z]{2}) (\d{1,2})$/;
const TIME_RE = /^(\d{1,2}) (\d{2}) (AM|PM)$/;
const EVENT_RE = /^([A-Z][a-z]{2}) (\d{1,2}) (\d{1,2}) (\d{2}) (AM|PM)$/;
const AMOUNT_RE = /(-?)EGP ([\d,]+\.\d{2})/g;
const RANGE_RE = /([A-Z][a-z]{2}) (\d{1,2}), (\d{4}).*?-\s*([A-Z][a-z]{2}) (\d{1,2}), (\d{4})/;

export type StatementRecord = {
  kind: "trip" | "tip" | "fee" | "bonus" | "transfer" | "other";
  product: string;
  eventAt: Date; // trip request time — the stable key for matching
  earnings: number; // driver net (first amounts column)
  cashCollected: number | null; // |second amount| when the row is a cash trip
  isCash: boolean;
};

export type ParsedStatement = {
  weekStart: Date | null;
  weekEnd: Date | null;
  records: StatementRecord[];
};

function to24h(h: number, ampm: string): number {
  if (ampm === "PM" && h !== 12) return h + 12;
  if (ampm === "AM" && h === 12) return 0;
  return h;
}

export function parseStatementText(rawText: string): ParsedStatement {
  // pdf-parse emits NUL between hour and minute digits ("4 00 AM")
  const text = rawText.replace(/\u0000/g, " ");
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Week range from the header (repeats on every page — take the first hit)
  let weekStart: Date | null = null;
  let weekEnd: Date | null = null;
  for (const l of lines) {
    const m = l.match(RANGE_RE);
    if (m) {
      weekStart = new Date(Number(m[3]), MONTHS[m[1]], Number(m[2]));
      weekEnd = new Date(Number(m[6]), MONTHS[m[4]], Number(m[5]));
      break;
    }
  }

  const yearFor = (monthIdx: number): number => {
    if (!weekStart || !weekEnd) return new Date().getFullYear();
    if (monthIdx === weekStart.getMonth()) return weekStart.getFullYear();
    if (monthIdx === weekEnd.getMonth()) return weekEnd.getFullYear();
    return weekStart.getFullYear();
  };

  const records: StatementRecord[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!DAY_RE.test(lines[i])) {
      i++;
      continue;
    }
    // processed date line → time line → product line(s) → event line → amounts
    let j = i + 1;
    if (j < lines.length && TIME_RE.test(lines[j])) j++;
    const productParts: string[] = [];
    while (j < lines.length && !EVENT_RE.test(lines[j]) && !DAY_RE.test(lines[j])) {
      // stop if we ran into an amounts line — malformed record
      if (lines[j].includes("EGP ")) break;
      productParts.push(lines[j]);
      j++;
    }
    const ev = j < lines.length ? lines[j].match(EVENT_RE) : null;
    if (!ev) {
      i = j;
      continue;
    }
    j++;
    if (j >= lines.length || !lines[j].includes("EGP ")) {
      i = j;
      continue;
    }
    const amounts: number[] = [];
    for (const m of lines[j].matchAll(AMOUNT_RE)) {
      amounts.push((m[1] === "-" ? -1 : 1) * Number(m[2].replace(/,/g, "")));
    }
    j++;
    // running-balance line (a single amount) — consume silently
    if (j < lines.length && /^-?EGP [\d,]+\.\d{2}$/.test(lines[j])) j++;

    const product = productParts.join(" ").trim();
    const eventAt = new Date(
      yearFor(MONTHS[ev[1]]),
      MONTHS[ev[1]],
      Number(ev[2]),
      to24h(Number(ev[3]), ev[5]),
      Number(ev[4])
    );

    const p = product.toLowerCase();
    let kind: StatementRecord["kind"] = "trip";
    if (p === "tip" || p.startsWith("tip ")) kind = "tip";
    else if (p.includes("transfer")) kind = "transfer";
    else if (p.includes("fee")) kind = "fee";
    else if (p.includes("promotion") || p.includes("boost") || p.includes("quest")) kind = "bonus";

    const isCash = kind === "trip" && amounts.length >= 3 && amounts[1] < 0;
    records.push({
      kind,
      product,
      eventAt,
      earnings: amounts[0] ?? 0,
      cashCollected: isCash ? Math.abs(amounts[1]) : null,
      isCash,
    });
    i = j;
  }

  return { weekStart, weekEnd, records };
}
