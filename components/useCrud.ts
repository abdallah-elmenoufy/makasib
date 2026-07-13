"use client";
import { useCallback, useEffect, useState } from "react";

export function useCrud<T extends { id: string }>(entity: string, vehicleId?: string | null) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const qs = vehicleId ? `?vehicleId=${vehicleId}` : "";
    const res = await fetch(`/api/${entity}${qs}`);
    if (res.ok) setRows(await res.json());
    setLoading(false);
  }, [entity, vehicleId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = async (data: Record<string, unknown>) => {
    const res = await fetch(`/api/${entity}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) await refresh();
    return res.ok;
  };

  const update = async (id: string, data: Record<string, unknown>) => {
    const res = await fetch(`/api/${entity}/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) await refresh();
    return res.ok;
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/${entity}/${id}`, { method: "DELETE" });
    if (res.ok) await refresh();
    return res.ok;
  };

  return { rows, loading, refresh, create, update, remove };
}

/** First active vehicle — the app's working vehicle. */
export function useVehicle() {
  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/vehicles")
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        setVehicle(list.find((v: any) => v.isActive) ?? list[0] ?? null);
        setLoading(false);
      });
  }, []);
  return { vehicle, loading };
}
