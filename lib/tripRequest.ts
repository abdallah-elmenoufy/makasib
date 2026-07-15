// Parser for OCR text of the Uber trip-request card (the offer screen the
// driver sees before accepting). Uber Egypt shows the fare net of service fee
// ("Net of Service Fee" chip) plus pickup and trip distance estimates. Pure.

const AWAY_RE = /(\d+)\s*mins?\s*[({[]?\s*([\d.]+)\s*km\s*[)}\]]?\s*away/i;
const TRIP_RE = /(\d+)\s*mins?\s*[({[]?\s*([\d.]+)\s*km\s*[)}\]]?\s*trip/i;
const FARE_RE = /EGP\s*([\d,]+\.\d{2})/i;
const CASH_RE = /cash\s*payment/i;
const CLOCK_RE = /(\d{1,2}):(\d{2})/;
const PRODUCT_RE = /\b(Business Comfort|Comfort|UberX Saver|UberX Priority|UberXL|UberX|Uber Bus|Scooter)\b/i;

export type TripRequest = {
  fare: number; // net offer
  isCash: boolean;
  pickupMin: number;
  pickupKm: number;
  tripMin: number | null;
  tripKm: number | null;
  product: string | null;
  clock: string | null; // HH:mm from the status bar, if legible (12h-ambiguous)
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
  const product = text.match(PRODUCT_RE);
  // first clock-like token is the status-bar time
  const clock = text.match(CLOCK_RE);

  return {
    fare: Number(fare[1].replace(/,/g, "")),
    isCash: CASH_RE.test(text),
    pickupMin: Number(away[1]),
    pickupKm: Number(away[2]),
    tripMin: trip ? Number(trip[1]) : null,
    tripKm: trip ? Number(trip[2]) : null,
    product: product ? product[1] : null,
    clock: clock ? `${clock[1].padStart(2, "0")}:${clock[2]}` : null,
  };
}
