"use client";
import { useI18n } from "./I18nProvider";
import { useVehicle } from "./VehicleProvider";
import Link from "next/link";
import { Icon } from "./icons";
import { CarRender } from "./CarRender";

/** The driver's current default car; a dropdown once they have more than one. */
export function VehicleSwitcher({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const { vehicle, activeVehicles, loading, setDefaultVehicle } = useVehicle();

  if (loading || !vehicle) return null;

  if (activeVehicles.length < 2) {
    return (
      <Link
        href="/cars"
        className={`flex items-center gap-2 rounded-full bg-surface-2 text-sm font-bold text-ink hover:bg-line ${compact ? "px-3 h-9" : "px-3 h-10 mb-2"}`}
      >
        <CarRender make={vehicle.make} model={vehicle.model} color={vehicle.color} shadow={false} className="w-10 -my-1 shrink-0" />
        <span className="truncate">{vehicle.name}</span>
      </Link>
    );
  }

  return (
    <div className={compact ? "" : "mb-2"}>
      <label className="relative flex items-center">
        <CarRender make={vehicle.make} model={vehicle.model} color={vehicle.color} shadow={false} className="absolute start-2 w-9 pointer-events-none" />
        <select
          value={vehicle.id}
          onChange={(e) => setDefaultVehicle(e.target.value)}
          className={`w-full appearance-none rounded-full bg-surface-2 ps-12 pe-8 text-sm font-bold text-ink focus:outline-none focus:ring-2 focus:ring-ink/20 ${compact ? "h-9" : "h-10"}`}
        >
          {activeVehicles.map((v: any) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <Icon name="chevron" size={16} className="absolute end-3 rotate-90 text-muted pointer-events-none" />
      </label>
      {!compact && (
        <Link href="/cars" className="block px-3 pt-1 text-xs text-muted hover:text-ink">
          {t("nav.cars")} →
        </Link>
      )}
    </div>
  );
}
