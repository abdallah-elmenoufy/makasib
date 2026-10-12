import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { parseWeekKey, weekEndFor, weekKey } from "@/lib/week";
import { tripNet, tripMinutes } from "@/lib/analytics";

// One pay week's trips as CSV — for reconciling against the Uber statement
// or keeping a personal archive. UTF-8 with a BOM so Excel opens Arabic
// addresses correctly; one row per trip, net-first like everything else.

const COLUMNS = [
  "date",
  "time",
  "platform",
  "payment",
  "earnings_net",
  "tip",
  "trip_km",
  "pickup_km",
  "pickup_min",
  "duration_min",
  "net_per_km",
  "net_per_min",
  "pickup_address",
  "dropoff_address",
  "pickup_lat",
  "pickup_lng",
  "dropoff_lat",
  "dropoff_lng",
  "source",
  "notes",
];

const cell = (v: unknown): string => {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const pad = (n: number) => String(n).padStart(2, "0");

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const vehicleId = req.nextUrl.searchParams.get("vehicleId");
    const week = req.nextUrl.searchParams.get("week");
    if (!vehicleId || !week) return new Response("vehicleId and week required", { status: 400 });
    const start = parseWeekKey(week);
    if (!start) return new Response("bad week", { status: 400 });
    const end = weekEndFor(start);

    const trips = await prisma.trip.findMany({
      where: { vehicleId, startTime: { gte: start, lt: end } },
      orderBy: { startTime: "asc" },
    });

    const rows = trips.map((t) => {
      const d = new Date(t.startTime);
      const net = tripNet(t) - t.tip;
      const mins = tripMinutes(t);
      return [
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        `${pad(d.getHours())}:${pad(d.getMinutes())}`,
        t.platform,
        t.paymentType,
        net.toFixed(2),
        t.tip.toFixed(2),
        t.distanceKm ?? "",
        t.pickupKm ?? "",
        t.pickupMin ?? "",
        mins > 0 ? Math.round(mins) : "",
        t.distanceKm && t.distanceKm > 0 ? (net / t.distanceKm).toFixed(2) : "",
        mins > 0 ? (net / mins).toFixed(2) : "",
        t.pickupAddress ?? "",
        t.dropoffAddress ?? "",
        t.pickupLat ?? "",
        t.pickupLng ?? "",
        t.dropoffLat ?? "",
        t.dropoffLng ?? "",
        t.source,
        t.notes ?? "",
      ]
        .map(cell)
        .join(",");
    });

    const csv = "﻿" + [COLUMNS.join(","), ...rows].join("\r\n") + "\r\n";
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="makasib-week-${weekKey(start)}.csv"`,
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return new Response("failed", { status: 500 });
  }
}
