"use client";
import { useI18n } from "./I18nProvider";
import { useVehicle } from "./VehicleProvider";
import Link from "next/link";

/** Shows the driver's current default car and, once they own more than one
 * active car, a dropdown to switch it — the switch applies everywhere
 * (shifts, trips, dashboard, …) until changed again. */
export function VehicleSwitcher() {
  const { t } = useI18n();
  const { vehicle, activeVehicles, loading, setDefaultVehicle } = useVehicle();

  if (loading || !vehicle) return null;

  if (activeVehicles.length < 2) {
    return (
      <Link
        href="/cars"
        className="flex items-center gap-1.5 px-2 py-2 mb-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100"
      >
        <span>🚘</span>
        <span className="truncate">{vehicle.name}</span>
      </Link>
    );
  }

  return (
    <div className="mb-2">
      <label className="flex items-center gap-1.5 px-2">
        <span className="text-base">🚘</span>
        <select
          value={vehicle.id}
          onChange={(e) => setDefaultVehicle(e.target.value)}
          className="flex-1 min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {activeVehicles.map((v: any) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      <Link href="/cars" className="block px-2 pt-1 text-xs text-emerald-600 hover:underline">
        {t("nav.cars")} →
      </Link>
    </div>
  );
}
