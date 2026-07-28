"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

type VehicleContextValue = {
  vehicle: any;
  vehicles: any[];
  activeVehicles: any[];
  loading: boolean;
  setDefaultVehicle: (id: string) => Promise<void>;
  refreshVehicles: () => Promise<void>;
};

const VehicleContext = createContext<VehicleContextValue | null>(null);

/**
 * Single shared fetch of the driver's cars + sticky default, mounted once at
 * the app layout so every consumer (Nav's switcher, the shift-start car
 * picker, the dashboard, /cars) sees the same state and re-renders together
 * when a car is added/archived or the default is switched — instead of each
 * page holding its own stale copy fetched only on its own mount.
 */
export function VehicleProvider({ children }: { children: React.ReactNode }) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [defaultVehicleId, setDefaultVehicleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [vRes, sRes] = await Promise.all([fetch("/api/vehicles"), fetch("/api/settings")]);
    const list = vRes.ok ? await vRes.json() : [];
    const settings = sRes.ok ? await sRes.json() : {};
    setVehicles(list);
    setDefaultVehicleId(settings.defaultVehicleId ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setDefaultVehicle = useCallback(async (id: string) => {
    setDefaultVehicleId(id); // optimistic
    await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ defaultVehicleId: id }),
    });
  }, []);

  const active = vehicles.filter((v: any) => v.isActive);
  // only honor the sticky default while it's still an active car — an
  // archived car (e.g. sold) must never keep receiving new shifts/trips
  const vehicle =
    active.find((v: any) => v.id === defaultVehicleId) ?? active[0] ?? vehicles[0] ?? null;

  return (
    <VehicleContext.Provider
      value={{ vehicle, vehicles, activeVehicles: active, loading, setDefaultVehicle, refreshVehicles: refresh }}
    >
      {children}
    </VehicleContext.Provider>
  );
}

/** The driver's sticky "default car" — see VehicleProvider. */
export function useVehicle(): VehicleContextValue {
  const ctx = useContext(VehicleContext);
  if (!ctx) throw new Error("useVehicle() must be used within <VehicleProvider>");
  return ctx;
}
