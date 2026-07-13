"use client";
import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { Btn, Card, Empty, Field, PageTitle, Select } from "@/components/ui";
import { useVehicle } from "@/components/useCrud";

const PLATFORMS = ["UBER", "CAREEM", "INDRIVE", "BOLT", "OTHER"];
const TARGET_FIELDS = ["startTime", "fare", "distanceKm", "paymentType", "tip"] as const;

/** Minimal CSV parser with quoted-field support. */
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

/** Guess which CSV column maps to each field from common header names. */
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

export default function ImportPage() {
  const { t } = useI18n();
  const { vehicle, loading } = useVehicle();
  const [platform, setPlatform] = useState("UBER");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

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
      body: JSON.stringify({ vehicleId: vehicle.id, platform, rows: payload }),
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
    <div>
      <PageTitle>{t("im.title")}</PageTitle>
      <p className="text-sm text-slate-500 mb-4">{t("im.hint")}</p>

      <Card className="space-y-4">
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

            <Btn onClick={doImport} disabled={busy || mapping.startTime === undefined || mapping.fare === undefined}>
              📥 {t("im.import")}
            </Btn>
          </>
        )}

        {result && <p className="text-emerald-600 text-sm font-semibold">{result}</p>}
      </Card>
    </div>
  );
}
