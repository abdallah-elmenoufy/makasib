import { toLocalInput } from "./format";

export const PLATFORMS = ["UBER", "CAREEM", "INDRIVE", "BOLT", "OTHER"];

export type TripFormState = {
  platform: string;
  startTime: string;
  earnings: string;
  cashCollected: string;
  distanceKm: string;
  paymentType: string;
  tip: string;
  notes: string;
};

export function emptyTripForm(): TripFormState {
  return {
    platform: "UBER",
    startTime: toLocalInput(),
    earnings: "",
    cashCollected: "",
    distanceKm: "",
    paymentType: "CASH",
    tip: "",
    notes: "",
  };
}

// Net-first: the driver types what the platform shows (net earnings) plus the
// cash actually collected; fare/commission are derived for storage (see
// DOCS.md §5 for why fare/commission aren't the naive "gross fare"/"cut").
export function toTripData(form: TripFormState) {
  const earnings = Number(form.earnings);
  const cash = form.paymentType === "CASH" && form.cashCollected !== "" ? Number(form.cashCollected) : null;
  return {
    platform: form.platform,
    startTime: new Date(form.startTime).toISOString(),
    fare: cash ?? earnings,
    commission: cash != null ? cash - earnings : 0,
    distanceKm: form.distanceKm,
    paymentType: form.paymentType,
    tip: form.tip,
    notes: form.notes,
  };
}
