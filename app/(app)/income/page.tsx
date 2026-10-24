"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Btn, Card, Empty, Field, Input, PageTitle, Segmented, Select } from "@/components/ui";
import { Icon } from "@/components/icons";
import { useVehicle } from "@/components/VehicleProvider";
import { fmtDate, fmtInt, fmtMoney, localizeDigits } from "@/lib/format";
import { translate } from "@/lib/i18n/messages";

// Proof of income: drivers have no payslip, but banks, landlords and
// embassies ask for one. A printable statement built from the same numbers.

type Preset = "lastMonth" | "last3" | "last6" | "last12" | "thisYear" | "lastYear" | "custom";
const PRESETS: Preset[] = ["last3", "last6", "last12", "lastMonth", "thisYear", "lastYear", "custom"];

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Whole calendar months ending with the last complete one, so banks see full months. */
function presetRange(p: Preset, now = new Date()): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const lastDayPrev = new Date(y, m, 0);
  const back = (n: number) => ({ from: ymd(new Date(y, m - n, 1)), to: ymd(lastDayPrev) });
  switch (p) {
    case "lastMonth": return back(1);
    case "last3": return back(3);
    case "last6": return back(6);
    case "last12": return back(12);
    case "thisYear": return { from: ymd(new Date(y, 0, 1)), to: ymd(now) };
    case "lastYear": return { from: ymd(new Date(y - 1, 0, 1)), to: ymd(new Date(y - 1, 11, 31)) };
    default: return back(3);
  }
}

const read = (k: string) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };

export default function IncomePage() {
  const { t, locale } = useI18n();
  const { activeVehicles } = useVehicle();
  const [preset, setPreset] = useState<Preset>("last3");
  const [range, setRange] = useState(() => presetRange("last3"));
  const [car, setCar] = useState("all");
  const [name, setName] = useState("");
  const [docLocale, setDocLocale] = useState<"ar" | "en">(locale === "ar" ? "ar" : "en");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => setName(read("statementName")), []);
  useEffect(() => {
    if (preset !== "custom") setRange(presetRange(preset));
  }, [preset]);
  useEffect(() => {
    if (!range.from || !range.to || range.to < range.from) return;
    let alive = true;
    setLoading(true);
    const q = new URLSearchParams({ from: range.from, to: range.to });
    if (car !== "all") q.set("vehicleId", car);
    fetch(`/api/income?${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setData(d))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [range.from, range.to, car]);

  return (
    <div>
      <div className="no-print">
        <PageTitle sub={t("inc.subtitle")}>{t("inc.title")}</PageTitle>
        <Card className="mb-5">
          <div className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
            <Field label={t("inc.period")} className="md:col-span-2">
              <Segmented value={preset} onChange={setPreset} options={PRESETS.map((p) => ({ value: p, label: t(`inc.preset.${p}`) }))} />
            </Field>
            {preset === "custom" && (
              <>
                <Field label={t("inc.from")}><Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} /></Field>
                <Field label={t("inc.to")}><Input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} /></Field>
              </>
            )}
            <Field label={t("inc.name")}>
              <Input value={name} placeholder={t("inc.namePh")} onChange={(e) => { setName(e.target.value); write("statementName", e.target.value); }} />
            </Field>
            {activeVehicles.length > 1 && (
              <Field label={t("inc.cars")}>
                <Select value={car} onChange={(e) => setCar(e.target.value)}>
                  <option value="all">{t("cars.allCars")}</option>
                  {activeVehicles.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </Select>
              </Field>
            )}
            <Field label={t("inc.docLanguage")}>
              <Segmented fill value={docLocale} onChange={setDocLocale} options={[{ value: "ar", label: "العربية" }, { value: "en", label: "English" }]} />
            </Field>
          </div>
          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <Btn onClick={() => window.print()} disabled={!data}>
              <Icon name="download" size={18} /> {t("inc.print")}
            </Btn>
            <span className="text-xs text-muted leading-relaxed">{t("inc.printHint")}</span>
          </div>
        </Card>
      </div>
      {!data ? (
        <Card className="no-print"><Empty>{loading ? t("inc.loading") : t("c.noData")}</Empty></Card>
      ) : (
        <Statement data={data} name={name} docLocale={docLocale} faded={loading} />
      )}
    </div>
  );
}

function Statement({ data, name, docLocale, faded }: { data: any; name: string; docLocale: "ar" | "en"; faded: boolean }) {
  const tt = (k: string, vars?: Record<string, string | number>) => translate(docLocale, k, vars);
  const L = docLocale;
  const money = (n: number) => fmtMoney(Math.round(n), L);
  const intl = L === "ar" ? "ar-EG" : "en-GB";
  const monthName = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return new Intl.DateTimeFormat(intl, { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
  };
  const from = new Date(data.from);
  const toIncl = new Date(new Date(data.to).getTime() - 1);
  const months: any[] = data.months;
  const active = months.filter((m) => m.trips > 0 || m.income > 0);
  const avg = active.length ? data.total.income / active.length : 0;
  const running = (m: any) => m.fuel + m.maintenance + m.expenses;
  const ref = `MKS-${ymd(from).slice(0, 7).replace("-", "")}-${ymd(toIncl).slice(0, 7).replace("-", "")}`;
  const cars = data.vehicles.map((v: any) => [v.make, v.model].filter(Boolean).join(" ") || v.name).join(" · ");
  const plates = data.vehicles.map((v: any) => v.plate).filter(Boolean).join(" · ");

  return (
    <article dir={L === "ar" ? "rtl" : "ltr"} lang={L} className={`statement bg-white text-[#111] rounded-2xl border border-line shadow-[var(--shadow-card)] p-6 md:p-10 max-w-[820px] mx-auto transition-opacity ${faded ? "opacity-60" : ""}`}>
      <header className="flex items-start justify-between gap-4 pb-5 border-b-2 border-[#111]">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl brand-gradient text-white flex items-center justify-center text-lg font-bold">م</span>
          <div>
            <div className="text-xl font-bold">{tt("appName")}</div>
            <div className="text-xs text-[#555]">{tt("inc.docTagline")}</div>
          </div>
        </div>
        <div className="text-end">
          <div className="text-lg font-bold">{tt("inc.docTitle")}</div>
          <div className="text-xs text-[#555] mt-0.5">{tt("inc.ref")}: <span dir="ltr" className="whitespace-nowrap">{ref}</span></div>
        </div>
      </header>

      <section className="grid sm:grid-cols-3 gap-4 py-5 text-sm">
        <div>
          <div className="text-xs text-[#666]">{tt("inc.preparedFor")}</div>
          <div className="font-bold mt-0.5">{name || "—"}</div>
          <div className="text-xs text-[#555]">{tt("inc.occupation")}</div>
        </div>
        <div>
          <div className="text-xs text-[#666]">{tt("inc.period")}</div>
          <div className="font-bold mt-0.5">{fmtDate(from, L)} – {fmtDate(toIncl, L)}</div>
        </div>
        <div>
          <div className="text-xs text-[#666]">{tt("inc.vehicles")}</div>
          <div className="font-bold mt-0.5">{cars || "—"}</div>
          {plates && <div className="text-xs text-[#555]">{plates}</div>}
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Figure label={tt("inc.totalIncome")} value={money(data.total.income)} strong />
        <Figure label={tt("inc.avgMonth")} value={money(avg)} />
        <Figure label={tt("inc.netProfit")} value={money(data.total.cashProfit)} />
        <Figure
          label={tt("inc.activity")}
          value={`${fmtInt(data.total.trips, L)} ${tt("inc.tripsWord")}`}
          sub={`${fmtInt(Math.round(data.total.hours), L)} ${tt("inc.hoursWord")} · ${fmtInt(data.total.days, L)} ${tt("inc.daysWord")}`}
        />
      </section>

      <section className="mt-6 overflow-x-auto">
        <table className="w-full text-[13px] sm:text-sm border-collapse [&_td+td]:ps-3 [&_th+th]:ps-3">
          <thead>
            <tr className="text-xs text-[#555] border-b border-[#999]">
              <th className="text-start py-2 font-bold">{tt("inc.month")}</th>
              <th className="text-end py-2 font-bold">{tt("inc.income")}</th>
              <th className="hidden sm:table-cell text-end py-2 font-bold">{tt("inc.tipsBonuses")}</th>
              <th className="hidden sm:table-cell text-end py-2 font-bold">{tt("inc.runningCosts")}</th>
              <th className="text-end py-2 font-bold">{tt("inc.net")}</th>
              <th className="hidden sm:table-cell text-end py-2 font-bold">{tt("inc.trips")}</th>
              <th className="hidden sm:table-cell text-end py-2 font-bold">{tt("inc.days")}</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.key} className="border-b border-[#e3e3e3]">
                <td className="py-2 pe-3 whitespace-nowrap">{monthName(m.key)}</td>
                <td className="py-2 text-end tabular-nums font-bold">{money(m.income)}</td>
                <td className="hidden sm:table-cell py-2 text-end tabular-nums">{money(m.tips + m.bonuses)}</td>
                <td className="hidden sm:table-cell py-2 text-end tabular-nums">{money(running(m))}</td>
                <td className="py-2 text-end tabular-nums">{money(m.cashProfit)}</td>
                <td className="hidden sm:table-cell py-2 text-end tabular-nums">{fmtInt(m.trips, L)}</td>
                <td className="hidden sm:table-cell py-2 text-end tabular-nums">{fmtInt(m.days, L)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#111] font-bold">
              <td className="py-2">{tt("inc.total")}</td>
              <td className="py-2 text-end tabular-nums">{money(data.total.income)}</td>
              <td className="hidden sm:table-cell py-2 text-end tabular-nums">{money(data.total.tips + data.total.bonuses)}</td>
              <td className="hidden sm:table-cell py-2 text-end tabular-nums">{money(running(data.total))}</td>
              <td className="py-2 text-end tabular-nums">{money(data.total.cashProfit)}</td>
              <td className="hidden sm:table-cell py-2 text-end tabular-nums">{fmtInt(data.total.trips, L)}</td>
              <td className="hidden sm:table-cell py-2 text-end tabular-nums">{fmtInt(data.total.days, L)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {data.platforms.length > 0 && (
        <section className="mt-6">
          <div className="text-xs font-bold text-[#555] mb-2">{tt("inc.byPlatform")}</div>
          <div className="flex flex-wrap gap-2">
            {data.platforms.map((p: any) => (
              <span key={p.platform} className="text-sm border border-[#ccc] rounded-lg px-3 py-1.5">
                <b>{tt(`pf.${p.platform}`)}</b> · {money(p.net)} · {fmtInt(p.trips, L)} {tt("inc.tripsWord")}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6 text-xs text-[#444] leading-relaxed space-y-1.5">
        <p>{tt("inc.noteIncome")}</p>
        <p>{tt("inc.noteCosts")}</p>
        <p>{tt("inc.noteSource")}</p>
      </section>

      <footer className="mt-10 flex items-end justify-between gap-6 text-xs text-[#555]">
        <div className="flex-1 max-w-[260px]">
          <div className="border-b border-[#111] h-10" />
          <div className="mt-1.5">{tt("inc.signature")}</div>
        </div>
        <div className="text-end">{tt("inc.generated", { date: localizeDigits(fmtDate(data.generatedAt, L), L) })}</div>
      </footer>
    </article>
  );
}

function Figure({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${strong ? "border-[#111] bg-[#f4f4f1]" : "border-[#d6d6d6]"}`}>
      <div className="text-[11px] text-[#666]">{label}</div>
      <div className="text-lg md:text-xl font-bold tabular-nums mt-0.5 leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-[#555] mt-0.5">{sub}</div>}
    </div>
  );
}
