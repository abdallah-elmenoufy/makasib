import { toLocalInput } from "./format";

export const PLATFORMS = ["UBER", "CAREEM", "INDRIVE", "BOLT", "OTHER"];

export type TripFormState = {
  platform: string;
  startTime: string;
  earnings: string;
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
    distanceKm: "",
    paymentType: "CASH",
    tip: "",
    notes: "",
  };
}

// Net-first: the driver types what the platform shows (net earnings). Cash
// settlement with the platform is Uber's own ledger and is not tracked here
// (see DOCS.md §5).
export function toTripData(form: TripFormState) {
  const earnings = Number(form.earnings);
  return {
    platform: form.platform,
    startTime: new Date(form.startTime).toISOString(),
    fare: earnings,
    commission: 0,
    distanceKm: form.distanceKm,
    paymentType: form.paymentType,
    tip: form.tip,
    notes: form.notes,
  };
}
