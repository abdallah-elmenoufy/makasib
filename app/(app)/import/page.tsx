"use client";
import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { Btn, Card, Empty, Field, Input, PageTitle, Select } from "@/components/ui";
import { useVehicle } from "@/components/useCrud";
import { parseEarningsActivityText, ActivityTrip } from "@/lib/earningsActivity";
import { fmtDate } from "@/lib/format";

const PLATFORMS = ["UBER", "CAREEM", "INDRIVE", "BOLT", "OTHER"];
const TARGET_FIELDS = ["startTime", "fare", "distanceKm", "paymentType", "tip"] as const;

export default function ImportPage() {
  const { t } = useI18n();
  const { vehicle, loading } = useVehicle();
  const [tab, setTab] = useState<"pdf" | "ocr" | "csv">("pdf");

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
    { id: "pdf" as const, label: t("im.tabPdf") },
    { id: "ocr" as const, label: t("im.tabOcr") },
    { id: "csv" as const, label: t("im.tabCsv") },
  ];

  return (
    <div>
      <PageTitle>{t("im.title")}</PageTitle>
      <div className="flex gap-1 mb-4 bg-white border border-slate-200 rounded-lg p-1 w-fit flex-wrap">
        {tabs.map((x) => (
          <button
            key={x.id}
            onClick={() => setTab(x.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              tab === x.id ? "bg-emerald-600 text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>
      {tab === "pdf" && <PdfImport vehicleId={vehicle.id} />}
      {tab === "ocr" && <OcrImport vehicleId={vehicle.id} />}
      {tab === "csv" && <CsvImport vehicleId={vehicle.id} />}
    </div>
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
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setRows([]);
    setResult("");
    const { ocrScreenshot } = await import("@/lib/ocr");
    let all = "";
    for (let i = 0; i < files.length; i++) {
      setProgress(t("im.ocrReading", { i: i + 1, n: files.length }));
      all += "\n" + (await ocrScreenshot(files[i]));
    }
    setProgress("");
    const trips = parseEarningsActivityText(all, year);
    setRows(trips);
    if (trips.length === 0) setResult(t("im.ocrNoTrips"));
    setBusy(false);
  };

  const setRow = (i: number, patch: Partial<ActivityTrip>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const doImport = async () => {
    const payload = rows
      .filter((r) => r.date && r.time && Number.isFinite(r.earnings))
      .map((r) => ({
        startTime: new Date(`${r.date}T${r.time}:00`).toISOString(),
        earnings: r.earnings,
        cashCollected: r.cashCollected,
        distanceKm: r.distanceKm,
        product: r.product,
      }));
    setBusy(true);
    const res = await fetch("/api/import/activity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vehicleId, trips: payload }),
    });
    setBusy(false);
    if (!res.ok) {
      setResult(t("c.error"));
      return;
    }
    const d = await res.json();
    setResult(
      `✓ ${t("im.created", { n: d.created })} · ${t("im.merged", { n: d.merged })} · ${t("im.skippedN", { n: d.skipped })}`
    );
    setRows([]);
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
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="text-sm pb-2"
        />
        <Btn onClick={run} disabled={busy || files.length === 0}>
          🔍 {t("im.ocrRun")} {files.length > 0 ? `(${files.length})` : ""}
        </Btn>
      </div>
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
                  <tr key={i} className={!r.date || !r.time ? "bg-amber-50" : ""}>
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
                        value={r.earnings}
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
          <Btn onClick={doImport} disabled={busy}>
            📥 {t("im.import")}
          </Btn>
        </>
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
