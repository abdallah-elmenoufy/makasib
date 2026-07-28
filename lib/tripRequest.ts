// Parser for OCR text of the Uber trip-request card (the offer screen the
// driver sees before accepting). Uber Egypt shows the fare net of service fee
// ("Net of Service Fee" chip) plus pickup and trip distance estimates. Pure.

import { normalizeProduct } from "./earningsActivity";

const CURRENCY = "(?:EGP|ECP|EGF|E6P|£GP)";
const AWAY_RE = /(\d+)\s*mins?\s*[({[]?\s*([\d.]+)\s*km\s*[)}\]]?\s*away/i;
const TRIP_RE = /(\d+)\s*mins?\s*[({[]?\s*([\d.]+)\s*km\s*[)}\]]?\s*trip/i;
// decimal separator optional — tesseract frequently drops it ("EGP 39750"
// for "EGP 397.50"); recovered in money() below
const FARE_RE = new RegExp(`${CURRENCY}[A-Za-z]?\\s*([\\d,]+(?:\\.\\d{2})?)`, "i");
const CASH_RE = /cash\s*payment/i;
// tesseract frequently drops or misreads the ":" in the tiny status-bar
// clock ("11:20" → "11.20" or, worse, merges into an adjacent element like
// a nav-banner distance and becomes unrecoverable, e.g. "1184100" —
// confirmed against real trip-request screenshots). Tolerating "." keeps
// the "misread as period" case; scoping the search to the first couple of
// OCR'd lines (the status bar always comes first) keeps a stray decimal
// elsewhere in the card (a fare, a distance) from being mistaken for a time.
const CLOCK_RE = /\b(\d{1,2})[:.](\d{2})\b/;
const NOISE_RE =
  /accept|^match$|exclusive|net of service|priority pickup|included|toward your destination|wait-time earnings|^\d+\s*stops?$|4g|5g|wi-?fi|^\W*$/i;

function money(s: string): number {
  const cleaned = s.replace(/,/g, "");
  if (!cleaned.includes(".") && cleaned.length > 2) {
    return Number(`${cleaned.slice(0, -2)}.${cleaned.slice(-2)}`);
  }
  return Number(cleaned);
}

export type TripRequest = {
  fare: number; // net offer
  isCash: boolean;
  pickupMin: number;
  pickupKm: number;
  tripMin: number | null;
  tripKm: number | null;
  product: string | null;
  clock: string | null; // HH:mm from the status bar, if legible (12h-ambiguous)
  pickupAddress: string | null;
  dropoffAddress: string | null;
};

/** A screenshot is a request card when it has the "(x km) away" pickup line. */
export function looksLikeTripRequest(text: string): boolean {
  return AWAY_RE.test(text) && FARE_RE.test(text);
}

export function parseTripRequestText(text: string): TripRequest | null {
  const away = text.match(AWAY_RE);
  const fare = text.match(FARE_RE);
  if (!away || !fare) return null;

  const trip = text.match(TRIP_RE);
  const product = normalizeProduct(text.match(/^.*(?:Comfort|Uber|Saver|Priority|Scooter).*$/im)?.[0] ?? null);
  // the status bar clock is always among the first couple of OCR'd lines —
  // searching the whole text risks mistaking a fare/distance decimal
  // elsewhere in the card for a time (see CLOCK_RE's tolerant separator)
  const firstLines = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 3).join("\n");
  const clock = firstLines.match(CLOCK_RE);

  // addresses: the line(s) after "(x km) away" up to "(y km) trip" are the
  // pickup; after the trip line, until noise (Accept button etc.), the dropoff
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let pickupAddress: string | null = null;
  let dropoffAddress: string | null = null;
  let mode: "none" | "pickup" | "drop" = "none";
  for (const line of lines) {
    if (AWAY_RE.test(line)) {
      mode = "pickup";
      continue;
    }
    if (TRIP_RE.test(line)) {
      mode = "drop";
      continue;
    }
    if (mode === "none" || NOISE_RE.test(line) || FARE_RE.test(line)) continue;
    const cleaned = line.replace(/^[^\p{L}\d]+/u, "").trim();
    if (cleaned.length < 4) continue;
    // map labels are ALL-CAPS ("MEDIA PRODUCTION CITY") — end of the address
    const letters = cleaned.replace(/[^A-Za-z]/g, "");
    if (letters.length > 6 && letters === letters.toUpperCase()) {
      mode = "none";
      continue;
    }
    if (mode === "pickup") pickupAddress = pickupAddress ? `${pickupAddress} ${cleaned}` : cleaned;
    if (mode === "drop") {
      dropoffAddress = dropoffAddress ? `${dropoffAddress} ${cleaned}` : cleaned;
      if (dropoffAddress.length > 60) mode = "none";
    }
  }

  // OCR sometimes appends ALL-CAPS map labels to the same line as the
  // address — cut at the first pair of consecutive uppercase tokens
  const stripMapNoise = (s: string | null): string | null => {
    if (!s) return s;
    const tokens = s.split(/\s+/);
    const caps = (t: string) => t.length >= 2 && /[A-Z]/.test(t) && t === t.toUpperCase();
    let end = tokens.length;
    for (let i = 0; i < tokens.length - 1; i++) {
      if (caps(tokens[i]) && caps(tokens[i + 1])) {
        end = i;
        break;
      }
    }
    // also drop a lone trailing map-label token ("… Zayed MEDIA")
    while (end > 0 && caps(tokens[end - 1]) && tokens[end - 1].length >= 3) end--;
    const kept = tokens.slice(0, end).join(" ").replace(/[,\s]+$/, "");
    return kept.length >= 4 ? kept : null;
  };
  pickupAddress = stripMapNoise(pickupAddress);
  dropoffAddress = stripMapNoise(dropoffAddress);

  return {
    fare: money(fare[1]),
    isCash: CASH_RE.test(text),
    pickupMin: Number(away[1]),
    pickupKm: Number(away[2]),
    tripMin: trip ? Number(trip[1]) : null,
    tripKm: trip ? Number(trip[2]) : null,
    product,
    clock: clock ? `${clock[1].padStart(2, "0")}:${clock[2]}` : null,
    pickupAddress,
    dropoffAddress,
  };
}
