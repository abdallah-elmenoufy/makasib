"use client";
import { useCallback, useEffect, useState } from "react";

const PAGE_SIZE = 50;

/** Every list entity (all but `vehicles`, which is small and unpaginated
 *  server-side) is fetched 50 rows at a time; `page`/`setPage`/`totalPages`
 *  drive a Prev/Next control in the page's UI. */
export function useCrud<T extends { id: string }>(entity: string, vehicleId?: string | null) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const refresh = useCallback(async () => {
    const params = new URLSearchParams();
    if (vehicleId) params.set("vehicleId", vehicleId);
    params.set("page", String(page));
    const res = await fetch(`/api/${entity}?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        setRows(data);
        setTotal(data.length);
      } else {
        setRows(data.rows);
        setTotal(data.total);
      }
    }
    setLoading(false);
  }, [entity, vehicleId, page]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // the filter changed (different car, different entity) — the old page
  // number no longer means anything, so land back on page 1
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, vehicleId]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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

  return { rows, loading, refresh, create, update, remove, page, setPage, totalPages, total };
}

