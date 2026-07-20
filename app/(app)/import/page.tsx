"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { Btn, Card, Empty, Field, Input, PageTitle, Select, Textarea } from "@/components/ui";
import { useVehicle } from "@/components/useCrud";
import { parseEarningsActivityText, ActivityTrip } from "@/lib/earningsActivity";
import { looksLikeTripRequest, parseTripRequestText, TripRequest } from "@/lib/tripRequest";
import { emptyTripForm, toTripData, TripFormState, PLATFORMS as TRIP_PLATFORMS } from "@/lib/tripForm";
import { fmtDate, toLocalInput } from "@/lib/format";

const PLATFORMS = ["UBER", "CAREEM", "INDRIVE", "BOLT", "OTHER"];
const TARGET_FIELDS = ["startTime", "fare", "distanceKm", "paymentType", "tip"] as const;
const TABS = ["shift", "manual", "ocr", "pdf", "csv"] as const;
type Tab = (typeof TABS)[number];

export default function ImportPage() {
  return (
    <Suspense>
      <ImportInner />
    </Suspense>
  );
}

function ImportInner() {
  const { t } = useI18n();
  const { vehicle, loading } = useVehicle();
  const params = useSearchParams();
  const requested = params.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(
    requested && (TABS as readonly string[]).includes(requested) ? requested : "shift"
  );

  if (loading) return null;
  if (!vehicle) {
    return (
      <Empty>
        <Link href="/vehicle" className="text-emerald-600 underline">
          {t("veh.createFirst")}
        </Link>
      </Empty>
    );
  }

  const tabs = [
    { id: "shift" as const, label: `📷 ${t("im.tabShift")}` },
    { id: "manual" as const, label: `➕ ${t("im.tabManual")}` },
    { id: "ocr" as const, label: `📸 ${t("im.tabOcr")}` },
    { id: "pdf" as const, label: `📄 ${t("im.tabPdf")}` },
    { id: "csv" as const, label: t("im.tabCsv") },
  ];

  return (
    <div>
      <PageTitle>{t("im.title")}</PageTitle>
      <div className="grid grid-cols-2 sm:flex gap-1.5 mb-4 bg-white border border-slate-200 rounded-xl p-1.5 flex-wrap">
        {tabs.map((x) => (
          <button
            key={x.id}
            onClick={() => setTab(x.id)}
            className={`px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              tab === x.id ? "bg-emerald-600 text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>
      {tab === "shift" && <ShiftPhotosImport vehicle={vehicle} />}
      {tab === "manual" && <ManualTripImport vehicleId={vehicle.id} />}
      {tab === "pdf" && <PdfImport vehicleId={vehicle.id} />}
      {tab === "ocr" && <OcrImport vehicleId={vehicle.id} />}
      {tab === "csv" && <CsvImport vehicleId={vehicle.id} />}
    </div>
  );
}

/* ---------------- Manual trip entry ---------------- */

function ManualTripImport({ vehicleId }: { vehicleId: string }) {
  const { t } = useI18n();
  const [form, setForm] = useState<TripFormState>(emptyTripForm());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const set = (k: keyof TripFormState, v: string) => setForm({ ...form, [k]: v });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...toTripData(form), vehicleId }),
    });
    setBusy(false);
    if (res.ok) {
      setForm(emptyTripForm());
      setResult(`✓ ${t("c.saved")} — ${t("tr.autoMatch")}`);
      setTimeout(() => setResult(""), 3000);
    } else {
      setResult(t("c.error"));
    }
  };

  return (
    <Card>
      <form onSubmit={submit} className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Field label={t("tr.platform")}>
          <Select value={form.platform} onChange={(e) => set("platform", e.target.value)}>
            {TRIP_PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {t(`pf.${p}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("tr.startTime")}>
          <Input
            type="datetime-local"
            value={form.startTime}
            onChange={(e) => set("startTime", e.target.value)}
            required
          />
        </Field>
        <Field label={t("tr.earnings")} hint={t("tr.earningsHint")}>
          <Input
            type="number"
            step="0.01"
            value={form.earnings}
            onChange={(e) => set("earnings", e.target.value)}
            required
            autoFocus
          />
        </Field>
        <Field label={t("tr.payment")}>
          <Select value={form.paymentType} onChange={(e) => set("paymentType", e.target.value)}>
            <option value="CASH">{t("tr.CASH")}</option>
            <option value="CARD">{t("tr.CARD")}</option>
          </Select>
        </Field>
        {form.paymentType === "CASH" && (
          <Field label={t("tr.cashCollected")} hint={t("tr.cashCollectedHint")}>
            <Input
              type="number"
              step="0.01"
              value={form.cashCollected}
              onChange={(e) => set("cashCollected", e.target.value)}
            />
          </Field>
        )}
        <Field label={t("tr.distance")}>
          <Input type="number" step="0.1" value={form.distanceKm} onChange={(e) => set("distanceKm", e.target.value)} />
        </Field>
        <Field label={t("tr.tip")}>
          <Input type="number" step="0.01" value={form.tip} onChange={(e) => set("tip", e.target.value)} />
        </Field>
        <div className="col-span-2 md:col-span-3">
          <Field label={`${t("c.notes")} (${t("c.optional")})`}>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
        <div className="col-span-2 md:col-span-3 flex items-center gap-3">
          <Btn type="submit" disabled={busy}>
            {t("c.save")}
          </Btn>
          {result && <span className="text-emerald-700 text-sm font-semibold">{result}</span>}
        </div>
      </form>
    </Card>
  );
}

/* ---------------- Shift from odometer photos ---------------- */

type ShiftPhoto = {
  filename: string;
  time: string; // datetime-local value
  odo: string;
  fromExif: boolean;
  fromOcr: boolean;
};

function ShiftPhotosImport({ vehicle }: { vehicle: any }) {
  const { t } = useI18n();
  const [photos, setPhotos] = useState<ShiftPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState("");

  const processFiles = async (incoming: File[]) => {
    const images = incoming.filter((f) => f.type.startsWith("image/") || /\.heic$/i.test(f.name));
    if (images.length === 0 || busy) return;
    setBusy(true);
    setResult("");
    const next: ShiftPhoto[] = [...photos];
    for (let i = 0; i < images.length && next.length < 2; i++) {
      const file = images[i];
      setProgress(t("im.ocrReading", { i: i + 1, n: images.length }));

      // 1) upload for record-keeping
      const form = new FormData();
      form.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body: form });
      if (!up.ok) continue;
      const { filename } = await up.json();

      // 2) when the photo was taken (EXIF; file date as fallback)
      let when = new Date(file.lastModified);
      let fromExif = false;
      try {
        const exifr = (await import("exifr")).default;
        const meta = await exifr.parse(file, ["DateTimeOriginal", "CreateDate"]);
        const d = meta?.DateTimeOriginal ?? meta?.CreateDate;
        if (d instanceof Date && !isNaN(d.getTime())) {
          when = d;
          fromExif = true;
        }
      } catch {
        // HEIC or stripped metadata — fall back to file date
      }

      // 3) odometer digits — Apple Vision on the server reads dashboard LCDs
      // reliably; tesseract on the served JPEG is the fallback
      let odo = "";
      let fromOcr = false;
      try {
        const { serverOdometerCandidates, ocrOdometerCandidates } = await import("@/lib/ocr");
        let candidates = await serverOdometerCandidates(filename);
        if (candidates == null || candidates.length === 0) {
          const served = await fetch(`/api/files/${filename}`).then((r) => r.blob());
          candidates = await ocrOdometerCandidates(served);
        }
        const min = vehicle.initialOdometer ?? 0;
        const plausible = candidates.filter((c) => c >= min && c < min + 500_000);
        if (plausible.length > 0) {
          odo = String(plausible.sort((a, b) => a - b)[0]);
          fromOcr = true;
        }
      } catch {
        // OCR can't decode some formats (e.g. HEIC on Chrome) — manual entry
      }

      next.push({ filename, time: toLocalInput(when), odo, fromExif, fromOcr });
    }
    // earlier photo is the start
    next.sort((a, b) => a.time.localeCompare(b.time));
    setPhotos(next);
    setProgress("");
    setBusy(false);
  };

  const save = async () => {
    if (photos.length === 0) return;
    const [start, end] = photos;
    setBusy(true);
    const res = await fetch("/api/shifts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        vehicleId: vehicle.id,
        startTime: new Date(start.time).toISOString(),
        startOdometer: start.odo,
        startPhoto: start.filename,
        ...(end
          ? {
              endTime: new Date(end.time).toISOString(),
              endOdometer: end.odo,
              endPhoto: end.filename,
            }
          : {}),
      }),
    });
    setBusy(false);
    if (res.ok) {
      setResult(`✓ ${t("im.shiftSaved")}${end ? "" : ` — ${t("sh.active")}`}`);
      setPhotos([]);
    } else {
      setResult(t("c.error"));
    }
  };

  const setPhoto = (i: number, patch: Partial<ShiftPhoto>) =>
    setPhotos(photos.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const canSave =
    photos.length > 0 &&
    photos.every((p) => p.time && p.odo !== "") &&
    (photos.length < 2 || Number(photos[1].odo) > Number(photos[0].odo));

  return (
    <Card className="space-y-4">
      <p className="text-sm text-slate-500">{t("im.shiftHint")}</p>

      {photos.length < 2 && (
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            processFiles(Array.from(e.dataTransfer.files));
          }}
          className={`block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            busy ? "border-slate-200 text-slate-300" : "border-emerald-300 text-slate-500 hover:bg-emerald-50"
          }`}
        >
          <input
            type="file"
            accept="image/*,.heic"
            multiple
            disabled={busy}
            onChange={(e) => {
              processFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
            className="hidden"
          />
          <div className="text-3xl mb-1">🚗</div>
          <div className="text-sm font-semibold">{t("im.shiftDrop")}</div>
        </label>
      )}
      {progress && <p className="text-sm text-slate-400 animate-pulse">{progress}</p>}

      {photos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {photos.map((p, i) => (
            <div key={p.filename} className="border border-slate-200 rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">
                  {i === 0 ? `▶ ${t("im.shiftStart")}` : `⏹ ${t("im.shiftEnd")}`}
                </span>
                <button onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="text-red-400 text-xs">
                  ✕
                </button>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/files/${p.filename}`} alt="" className="h-24 w-full object-cover rounded-lg" />
              <Field
                label={i === 0 ? t("sh.startTime") : t("sh.endTime")}
                hint={p.fromExif ? `📷 ${t("im.timeFromPhoto")}` : undefined}
              >
                <Input type="datetime-local" value={p.time} onChange={(e) => setPhoto(i, { time: e.target.value })} />
              </Field>
              <Field
                label={i === 0 ? t("sh.startOdo") : t("sh.endOdo")}
                hint={p.fromOcr ? `📷 ${t("sh.ocrDetected")}` : undefined}
              >
                <Input
                  type="number"
                  step="0.1"
                  value={p.odo}
                  onChange={(e) => setPhoto(i, { odo: e.target.value })}
                  required
                />
              </Field>
            </div>
          ))}
        </div>
      )}

      {photos.length === 2 && photos[1].odo !== "" && Number(photos[1].odo) <= Number(photos[0].odo) && (
        <p className="text-xs text-red-600">{t("im.odoOrder")}</p>
      )}
      {photos.length > 0 && (
        <Btn onClick={save} disabled={busy || !canSave}>
          {t("c.save")} {photos.length === 1 ? `(${t("sh.start")})` : ""}
        </Btn>
      )}
      {result && <p className="text-emerald-700 text-sm font-semibold">{result}</p>}
    </Card>
  );
}

/* ---------------- Weekly statement PDF ---------------- */

function PdfImport({ vehicleId }: { vehicleId: string }) {
  const { t, locale } = useI18n();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>("");

  const onFile = async (file: File) => {
    setBusy(true);
    setResult("");
    const form = new FormData();
    form.append("vehicleId", vehicleId);
    form.append("file", file);
    const res = await fetch("/api/import/statement", { method: "POST", body: form });
    setBusy(false);
    if (!res.ok) {
      setResult(t("c.error"));
      return;
    }
    const d = await res.json();
    const parts = [
      t("im.created", { n: d.trips.created }),
      t("im.merged", { n: d.trips.merged }),
      t("im.skippedN", { n: d.trips.skipped }),
      t("im.tipsN", { n: d.tips }),
      t("im.feesN", { n: d.fees }),
    ];
    const week = d.week
      ? `${t("im.weekLabel")}: ${fmtDate(d.week.start, locale)} – ${fmtDate(d.week.end, locale)} · `
      : "";
    setResult(`✓ ${week}${parts.join(" · ")}`);
  };

  return (
    <Card className="space-y-3">
      <p className="text-sm text-slate-500">{t("im.pdfHint")}</p>
      <input
        type="file"
        accept=".pdf,application/pdf"
        disabled={busy}
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        className="text-sm"
      />
      {busy && <p className="text-sm text-slate-400 animate-pulse">…</p>}
      {result && <p className="text-emerald-700 text-sm font-semibold">{result}</p>}
    </Card>
  );
}

/* ---------------- Earnings Activity screenshots (OCR) ---------------- */

function OcrImport({ vehicleId }: { vehicleId: string }) {
  const { t } = useI18n();
  const [year, setYear] = useState(new Date().getFullYear());
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState("");
  const [rows, setRows] = useState<ActivityTrip[]>([]);
  const [reqs, setReqs] = useState<TripRequest[]>([]);
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (batch: File[]) => {
    if (batch.length === 0 || busy) return;
    setBusy(true);
    setRows([]);
    setReqs([]);
    setResult("");
    const { ocrScreenshot } = await import("@/lib/ocr");
    // each screenshot is OCR'd and parsed on its own — never concatenated
    // into one text blob first. Concatenating let an incomplete trailing
    // card's parse state leak into the next screenshot's lines (wrong
    // times/amounts attaching to the wrong trip — a real UAT bug).
    let activityTrips: ActivityTrip[] = [];
    const requests: TripRequest[] = [];
    for (let i = 0; i < batch.length; i++) {
      setProgress(t("im.ocrReading", { i: i + 1, n: batch.length }));
      const text = await ocrScreenshot(batch[i]);
      if (looksLikeTripRequest(text)) {
        const r = parseTripRequestText(text);
        if (r) requests.push(r);
      } else {
        activityTrips = activityTrips.concat(parseEarningsActivityText(text, year));
      }
    }
    setProgress("");
    // most screenshots in a batch are the same day, but only the topmost one
    // (closest to "now") shows the "Mon, Jul 20" header — the rest scroll
    // past it. Backfill trips with no date from the single date any
    // screenshot in the batch revealed, rather than leaving them all blank.
    const seenDates = new Set(activityTrips.map((t) => t.date).filter((d): d is string => d != null));
    const trips =
      seenDates.size === 1
        ? activityTrips.map((t) => (t.date == null ? { ...t, date: [...seenDates][0] } : t))
        : activityTrips;
    setRows(trips);
    setReqs(requests);
    if (trips.length === 0 && requests.length === 0) setResult(t("im.ocrNoTrips"));
    setBusy(false);
  };

  // one gesture: dropping/selecting screenshots starts reading immediately
  const addFiles = (incoming: File[]) => {
    const images = incoming.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    const batch = [...files, ...images];
    setFiles(batch);
    run(batch);
  };

  const setRow = (i: number, patch: Partial<ActivityTrip>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const doImport = async () => {
    setBusy(true);
    const parts: string[] = [];

    if (rows.length > 0) {
      const payload = rows
        .filter((r) => r.date && r.time && Number.isFinite(r.earnings))
        .map((r) => ({
          startTime: new Date(`${r.date}T${r.time}:00`).toISOString(),
          earnings: r.earnings,
          cashCollected: r.cashCollected,
          distanceKm: r.distanceKm,
          product: r.product,
          pickupAddress: r.pickupAddress,
          dropoffAddress: r.dropoffAddress,
        }));
      const res = await fetch("/api/import/activity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vehicleId, trips: payload }),
      });
      if (!res.ok) {
        setResult(t("c.error"));
        setBusy(false);
        return;
      }
      const d = await res.json();
      parts.push(
        t("im.created", { n: d.created }),
        t("im.merged", { n: d.merged }),
        t("im.skippedN", { n: d.skipped })
      );
    }

    if (reqs.length > 0) {
      // request cards go last so freshly imported trips are matchable
      const res = await fetch("/api/import/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vehicleId, requests: reqs }),
      });
      if (res.ok) {
        const d = await res.json();
        parts.push(t("im.reqEnriched", { n: d.enriched }));
        if (d.unmatched > 0) parts.push(t("im.reqUnmatched", { n: d.unmatched }));
      }
    }

    setBusy(false);
    setResult(`✓ ${parts.join(" · ")}`);
    setRows([]);
    setReqs([]);
    setFiles([]);
  };

  const inputCls = "w-full rounded border border-slate-200 px-1.5 py-1 text-xs bg-white";

  return (
    <Card className="space-y-4">
      <p className="text-sm text-slate-500">{t("im.ocrHint")}</p>
      <div className="flex items-end gap-3 flex-wrap">
        <Field label={t("im.ocrYear")}>
          <Input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-28"
          />
        </Field>
      </div>
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(Array.from(e.dataTransfer.files));
        }}
        className={`block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          busy ? "border-slate-200 text-slate-300" : "border-emerald-300 text-slate-500 hover:bg-emerald-50"
        }`}
      >
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
          className="hidden"
        />
        <div className="text-3xl mb-1">📸</div>
        <div className="text-sm font-semibold">
          {t("im.dropZone")} {files.length > 0 ? `(${files.length})` : ""}
        </div>
      </label>
      {progress && <p className="text-sm text-slate-400 animate-pulse">{progress}</p>}

      {rows.length > 0 && (
        <>
          <p className="text-xs text-slate-500">{t("im.ocrReview")}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-start text-slate-500 border-b border-slate-200">
                  {[
                    t("im.colDate"),
                    t("im.colTime"),
                    t("im.colProduct"),
                    t("im.colEarnings"),
                    t("im.colCash"),
                    t("im.colKm"),
                    "",
                  ].map((h, i) => (
                    <th key={i} className="text-start py-1.5 px-1 font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <tr key={i} className={!r.date || !r.time || !Number.isFinite(r.earnings) ? "bg-amber-50" : ""}>
                    <td className="py-1 px-1">
                      <input
                        type="date"
                        value={r.date ?? ""}
                        onChange={(e) => setRow(i, { date: e.target.value })}
                        className={inputCls}
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="time"
                        value={r.time ?? ""}
                        onChange={(e) => setRow(i, { time: e.target.value })}
                        className={inputCls}
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input
                        value={r.product ?? ""}
                        onChange={(e) => setRow(i, { product: e.target.value })}
                        className={inputCls}
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="number"
                        step="0.01"
                        value={Number.isFinite(r.earnings) ? r.earnings : ""}
                        placeholder="?"
                        onChange={(e) => setRow(i, { earnings: Number(e.target.value) })}
                        className={inputCls}
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="number"
                        step="0.01"
                        value={r.cashCollected ?? ""}
                        onChange={(e) =>
                          setRow(i, {
                            cashCollected: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className={inputCls}
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input
                        type="number"
                        step="0.01"
                        value={r.distanceKm ?? ""}
                        onChange={(e) =>
                          setRow(i, {
                            distanceKm: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className={inputCls}
                      />
                    </td>
                    <td className="py-1 px-1">
                      <button
                        onClick={() => setRows(rows.filter((_, j) => j !== i))}
                        className="text-red-400"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {reqs.length > 0 && (
        <>
          <p className="text-xs text-slate-500">
            {t("im.reqFound", { n: reqs.length })} — {t("im.reqHint")}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-start text-slate-500 border-b border-slate-200">
                  {[
                    t("im.colTime"),
                    t("im.colProduct"),
                    t("im.colEarnings"),
                    t("tr.payment"),
                    t("im.colPickup"),
                    t("im.colKm"),
                    "",
                  ].map((h, i) => (
                    <th key={i} className="text-start py-1.5 px-1 font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reqs.map((r, i) => (
                  <tr key={i}>
                    <td className="py-1.5 px-1">{r.clock ?? "—"}</td>
                    <td className="py-1.5 px-1">{r.product ?? "—"}</td>
                    <td className="py-1.5 px-1 font-semibold">{r.fare.toFixed(2)}</td>
                    <td className="py-1.5 px-1">{r.isCash ? t("tr.CASH") : t("tr.CARD")}</td>
                    <td className="py-1.5 px-1">{r.pickupKm}</td>
                    <td className="py-1.5 px-1">{r.tripKm ?? "—"}</td>
                    <td className="py-1.5 px-1">
                      <button
                        onClick={() => setReqs(reqs.filter((_, j) => j !== i))}
                        className="text-red-400"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(rows.length > 0 || reqs.length > 0) && (
        <Btn onClick={doImport} disabled={busy}>
          📥 {t("im.import")}
        </Btn>
      )}
      {result && <p className="text-emerald-700 text-sm font-semibold">{result}</p>}
    </Card>
  );
}

/* ---------------- Generic CSV ---------------- */

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

function guessMapping(headers: string[]): Record<string, number> {
  const patterns: Record<string, RegExp> = {
    startTime: /time|date|begin|start|وقت|تاريخ/i,
    fare: /fare|amount|total|earning|أجرة|مبلغ/i,
    distanceKm: /dist|km|كم|مسافة/i,
    paymentType: /pay|method|cash|دفع/i,
    tip: /tip|بقشيش/i,
  };
  const map: Record<string, number> = {};
  for (const f of TARGET_FIELDS) {
    const idx = headers.findIndex((h) => patterns[f].test(h));
    if (idx >= 0) map[f] = idx;
  }
  return map;
}

function CsvImport({ vehicleId }: { vehicleId: string }) {
  const { t } = useI18n();
  const [platform, setPlatform] = useState("UBER");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File) => {
    const parsed = parseCsv(await file.text());
    if (parsed.length < 2) return;
    setHeaders(parsed[0]);
    setRows(parsed.slice(1));
    setMapping(guessMapping(parsed[0]));
    setResult("");
  };

  const doImport = async () => {
    if (mapping.startTime === undefined || mapping.fare === undefined) return;
    setBusy(true);
    const payload = rows.map((r) => ({
      startTime: r[mapping.startTime],
      fare: r[mapping.fare],
      distanceKm: mapping.distanceKm !== undefined ? r[mapping.distanceKm] : undefined,
      paymentType: mapping.paymentType !== undefined ? r[mapping.paymentType] : undefined,
      tip: mapping.tip !== undefined ? r[mapping.tip] : undefined,
    }));
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vehicleId, platform, rows: payload }),
    });
    setBusy(false);
    if (res.ok) {
      const d = await res.json();
      setResult(t("im.done", { n: d.imported, m: d.matched }));
      setHeaders([]);
      setRows([]);
    } else setResult(t("c.error"));
  };

  return (
    <Card className="space-y-4">
      <p className="text-sm text-slate-500">{t("im.hint")}</p>
      <div className="flex gap-4 items-end flex-wrap">
        <Field label={t("tr.platform")}>
          <Select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-40">
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {t(`pf.${p}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("im.upload")}>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            className="text-sm"
          />
        </Field>
      </div>

      {headers.length > 0 && (
        <>
          <div>
            <div className="font-semibold text-sm">{t("im.map")}</div>
            <p className="text-xs text-slate-400 mb-2">{t("im.mapHint")}</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {TARGET_FIELDS.map((f) => (
                <Field key={f} label={t(`im.field.${f}`)}>
                  <Select
                    value={mapping[f] ?? -1}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      const next = { ...mapping };
                      if (v < 0) delete next[f];
                      else next[f] = v;
                      setMapping(next);
                    }}
                  >
                    <option value={-1}>{t("im.field.ignore")}</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h}
                      </option>
                    ))}
                  </Select>
                </Field>
              ))}
            </div>
          </div>

          <div>
            <div className="font-semibold text-sm mb-2">
              {t("im.preview")} ({rows.length})
            </div>
            <div className="overflow-x-auto max-h-48 overflow-y-auto border border-slate-100 rounded-lg">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    {headers.map((h, i) => (
                      <th key={i} className="text-start px-2 py-1 bg-slate-50 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((r, ri) => (
                    <tr key={ri} className="border-t border-slate-100">
                      {r.map((c, ci) => (
                        <td key={ci} className="px-2 py-1 whitespace-nowrap">
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Btn
            onClick={doImport}
            disabled={busy || mapping.startTime === undefined || mapping.fare === undefined}
          >
            📥 {t("im.import")}
          </Btn>
        </>
      )}
      {result && <p className="text-emerald-700 text-sm font-semibold">{result}</p>}
    </Card>
  );
}
