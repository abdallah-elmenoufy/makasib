"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import {
  AddPanel,
  Btn,
  Card,
  CardHead,
  Checkbox,
  Empty,
  Field,
  Gauge,
  Input,
  Meter,
  PageTitle,
  Pagination,
  Select,
  StackedMeter,
  Table,
  Textarea,
} from "@/components/ui";
import { useCrud } from "@/components/useCrud";
import { useVehicle } from "@/components/VehicleProvider";
import { PhotoInput } from "@/components/PhotoInput";
import { fmtDate, fmtMoney, fmtNum, toLocalInput } from "@/lib/format";

const FUEL_TYPES = ["PETROL_80", "PETROL_92", "PETROL_95", "CNG"];

/** One colour per fuel type, reused by the split bar and its legend. */
const FUEL_COLOR: Record<string, string> = {
  PETROL_80: "var(--muted-2)",
  PETROL_92: "#eda100",
  PETROL_95: "#2a78d6",
  CNG: "var(--money)",
};

/** Dial ceiling for the consumption gauge — a working range for a
 *  ride-hailing car, not an invented target. */
const CONSUMPTION_DIAL_MAX = 20;

const empty = () => ({
  date: toLocalInput(),
  odometer: "",
  fuelType: "PETROL_92",
  quantity: "",
  pricePerUnit: "",
  totalCost: "",
  fullTank: true,
  station: "",
  photo: null as string | null,
  notes: "",
});

export default function FuelPage() {
  const { t, locale } = useI18n();
  const { vehicle, loading: vLoading } = useVehicle();
  const { rows, loading, create, remove, page, setPage, totalPages } = useCrud<any>("fuelups", vehicle?.id);
  const [form, setForm] = useState<any>(empty());
  const [open, setOpen] = useState(false);
  // the table is paginated; the totals have to cover every fill-up ever
  const [allRows, setAllRows] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    if (!vehicle) return;
    fetch(`/api/fuelups?vehicleId=${vehicle.id}&all=1`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setAllRows(Array.isArray(d) ? d : []));
    fetch(`/api/analytics?vehicleId=${vehicle.id}&period=all`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setAnalytics);
    // `rows` changes identity on every create/delete (useCrud refetches),
    // which is exactly when the totals need recomputing
  }, [vehicle, rows]);

  const totals = useMemo(() => {
    const byType = new Map<string, { qty: number; spend: number; count: number }>();
    let spend = 0;
    let petrolQty = 0;
    let petrolSpend = 0;
    let petrolCount = 0;
    let cngQty = 0;
    for (const f of allRows) {
      const e = byType.get(f.fuelType) ?? { qty: 0, spend: 0, count: 0 };
      e.qty += f.quantity;
      e.spend += f.totalCost;
      e.count += 1;
      byType.set(f.fuelType, e);
      spend += f.totalCost;
      if (f.fuelType === "CNG") {
        cngQty += f.quantity;
      } else {
        petrolQty += f.quantity;
        petrolSpend += f.totalCost;
        petrolCount += 1;
      }
    }
    const latest = allRows.reduce(
      (best: any, f: any) => (best == null || new Date(f.date) > new Date(best.date) ? f : best),
      null
    );
    return {
      count: allRows.length,
      spend,
      petrolQty,
      petrolSpend,
      petrolCount,
      cngQty,
      latest,
      byType: FUEL_TYPES.filter((k) => byType.has(k)).map((k) => ({ key: k, ...byType.get(k)! })),
    };
  }, [allRows]);

  if (vLoading || loading) return null;
  if (!vehicle) {
    return (
      <Empty>
        <Link href="/cars" className="text-ink underline">
          {t("veh.createFirst")}
        </Link>
      </Empty>
    );
  }

  const set = (k: string, v: unknown) => {
    const next = { ...form, [k]: v };
    // auto-compute total when quantity & price are set (still editable)
    if ((k === "quantity" || k === "pricePerUnit") && next.quantity && next.pricePerUnit) {
      next.totalCost = String(Math.round(Number(next.quantity) * Number(next.pricePerUnit) * 100) / 100);
    }
    setForm(next);
  };

  const unit = form.fuelType === "CNG" ? t("c.m3") : t("c.liters");
  const money = (n: number) => fmtMoney(n, locale);
  const economy: any[] = analytics?.fuelEconomy ?? [];
  const workFuel: number | null = analytics?.costs?.fuel ?? null;
  const netRevenue: number | null = analytics?.earnings?.netRevenue ?? null;
  const fuelShare =
    workFuel != null && netRevenue != null && netRevenue > 0 ? workFuel / netRevenue : null;

  // total filled reads as one number per unit — litres and m³ are not addable
  const filledParts = [
    totals.petrolQty > 0 ? `${fmtNum(totals.petrolQty, locale)} ${t("c.liters")}` : null,
    totals.cngQty > 0 ? `${fmtNum(totals.cngQty, locale)} ${t("c.m3")}` : null,
  ].filter(Boolean) as string[];

  return (
    <div>
      <PageTitle>{t("fu.title")}</PageTitle>

      {totals.count > 0 && (
        <Card className="mb-4">
          <CardHead icon="⛽" title={t("fu.summaryTitle")} sub={t("fu.summarySub")} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted font-semibold">
                {t("fu.totalFilled")}
              </div>
              <div className="text-3xl font-black tnum mt-0.5 leading-tight">
                {filledParts.join(" + ") || "—"}
              </div>
              <div className="text-xs text-muted mt-1">
                {t("fu.fillUps", { n: fmtNum(totals.count, locale, 0) })}
                {totals.petrolCount > 0 &&
                  ` · ${t("fu.avgPerFill", {
                    q: `${fmtNum(totals.petrolQty / totals.petrolCount, locale)} ${t("c.liters")}`,
                  })}`}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted font-semibold">
                {t("fu.totalPaid")}
              </div>
              <div className="text-3xl font-black tnum mt-0.5 leading-tight text-ink">
                {money(totals.spend)}
              </div>
              <div className="text-xs text-muted mt-1">
                {totals.petrolQty > 0 &&
                  t("fu.avgPrice", {
                    p: money(totals.petrolSpend / totals.petrolQty),
                    unit: t("c.liters"),
                  })}
                {totals.latest && ` · ${t("fu.lastFill", { v: money(totals.latest.totalCost) })}`}
              </div>
            </div>

            <div className="flex justify-center">
              {economy.length > 0 ? (
                <Gauge
                  ratio={economy[0].per100 / CONSUMPTION_DIAL_MAX}
                  tone={economy[0].per100 <= 9 ? "good" : economy[0].per100 <= 13 ? "warn" : "bad"}
                  value={fmtNum(economy[0].per100, locale)}
                  unit={`${economy[0].unit === "m3" ? t("c.m3") : t("c.liters")} ${t("db.l100")}`}
                  minLabel="0"
                  maxLabel={String(CONSUMPTION_DIAL_MAX)}
                  caption={t("fu.consumptionCaption", { km: fmtNum(economy[0].distanceKm, locale, 0) })}
                />
              ) : (
                <p className="text-xs text-muted text-center">{t("fu.fullTankHint")}</p>
              )}
            </div>
          </div>

          {totals.byType.length > 1 && (
            <div className="mt-5 pt-4 border-t border-line">
              <div className="text-xs font-semibold text-ink-500 mb-2">{t("fu.byType")}</div>
              <StackedMeter
                segments={totals.byType.map((b) => ({
                  key: b.key,
                  value: b.spend,
                  color: FUEL_COLOR[b.key],
                  label: t(`fu.${b.key}`),
                }))}
              />
              <div className="mt-2 space-y-1">
                {totals.byType.map((b) => (
                  <div key={b.key} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: FUEL_COLOR[b.key] }} />
                    <span className="flex-1 text-ink-500">{t(`fu.${b.key}`)}</span>
                    <span className="text-muted tnum">
                      {fmtNum(b.qty, locale)} {b.key === "CNG" ? t("c.m3") : t("c.liters")}
                    </span>
                    <span className="font-semibold tnum w-24 text-end">{money(b.spend)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {fuelShare != null && (
            <div className="mt-5 pt-4 border-t border-line">
              <Meter
                ratio={fuelShare}
                tone={fuelShare <= 0.25 ? "good" : fuelShare <= 0.4 ? "warn" : "bad"}
                label={t("fu.shareOfEarnings")}
                value={`${fmtNum(fuelShare * 100, locale, 0)}%`}
                sub={t("fu.shareOfEarningsSub", { spend: money(workFuel!), revenue: money(netRevenue!) })}
              />
            </div>
          )}
        </Card>
      )}

      {economy.length > 0 && totals.latest && analytics && (
        <FuelShockCard
          litresPerKm={economy[0].per100 / 100}
          unitLabel={economy[0].unit === "m3" ? t("c.m3") : t("c.liters")}
          latestPrice={totals.latest.pricePerUnit}
          weeklyKm={
            analytics.counts.daysActive > 0
              ? (analytics.kmSplit.shiftKm / analytics.counts.daysActive) * 7
              : 0
          }
          kmPerHour={
            analytics.counts.hoursWorked > 0
              ? analytics.kmSplit.shiftKm / analytics.counts.hoursWorked
              : 0
          }
          t={t}
          locale={locale}
        />
      )}

      <AddPanel buttonLabel={t("fu.add")} open={open} setOpen={setOpen}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await create({ ...form, vehicleId: vehicle.id, date: new Date(form.date).toISOString() })
            ) {
              setForm(empty());
              setOpen(false);
            }
          }}
          className="grid grid-cols-2 md:grid-cols-3 gap-3"
        >
          <Field label={t("c.date")}>
            <Input type="datetime-local" value={form.date} onChange={(e) => set("date", e.target.value)} required />
          </Field>
          <Field label={t("c.odometer")}>
            <Input type="number" step="0.1" value={form.odometer} onChange={(e) => set("odometer", e.target.value)} required />
          </Field>
          <Field label={t("fu.type")}>
            <Select value={form.fuelType} onChange={(e) => set("fuelType", e.target.value)}>
              {FUEL_TYPES.filter((f) =>
                vehicle.fuelSetup === "PETROL" ? f !== "CNG" : vehicle.fuelSetup === "CNG" ? f === "CNG" : true
              ).map((f) => (
                <option key={f} value={f}>
                  {t(`fu.${f}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={`${t("fu.quantity")} (${unit})`}>
            <Input type="number" step="0.01" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} required />
          </Field>
          <Field label={t("fu.pricePerUnit")}>
            <Input type="number" step="0.01" value={form.pricePerUnit} onChange={(e) => set("pricePerUnit", e.target.value)} required />
          </Field>
          <Field label={t("fu.totalCost")}>
            <Input type="number" step="0.01" value={form.totalCost} onChange={(e) => set("totalCost", e.target.value)} required />
          </Field>
          <Field label={`${t("fu.station")} (${t("c.optional")})`}>
            <Input value={form.station} onChange={(e) => set("station", e.target.value)} />
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox label={t("fu.fullTank")} checked={form.fullTank} onChange={(v) => set("fullTank", v)} />
          </div>
          <Field label={`${t("c.photo")} (${t("c.optional")})`}>
            <PhotoInput value={form.photo} onChange={(v) => set("photo", v)} />
          </Field>
          <div className="col-span-2 md:col-span-3">
            <Field label={`${t("c.notes")} (${t("c.optional")})`} hint={t("fu.fullTankHint")}>
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </div>
          <div className="col-span-2 md:col-span-3">
            <Btn type="submit">{t("c.save")}</Btn>
          </div>
        </form>
      </AddPanel>

      <Card>
        {rows.length === 0 ? (
          <Empty>{t("c.noData")}</Empty>
        ) : (
          <Table
            head={[
              t("c.date"),
              t("c.odometer"),
              t("fu.type"),
              t("fu.quantity"),
              t("fu.pricePerUnit"),
              t("fu.totalCost"),
              t("fu.fullTank"),
              t("c.notes"),
              "",
            ]}
          >
            {rows.map((f) => (
              <tr key={f.id}>
                <td className="py-2 px-2 whitespace-nowrap">{fmtDate(f.date, locale)}</td>
                <td className="py-2 px-2">{fmtNum(f.odometer, locale)}</td>
                <td className="py-2 px-2">{t(`fu.${f.fuelType}`)}</td>
                <td className="py-2 px-2">
                  {fmtNum(f.quantity, locale)} {f.fuelType === "CNG" ? t("c.m3") : t("c.liters")}
                </td>
                <td className="py-2 px-2">{fmtMoney(f.pricePerUnit, locale)}</td>
                <td className="py-2 px-2 font-semibold">{fmtMoney(f.totalCost, locale)}</td>
                <td className="py-2 px-2">{f.fullTank ? "✓" : "—"}</td>
                <td className="py-2 px-2 text-muted max-w-32 truncate">{f.notes ?? ""}</td>
                <td className="py-2 px-2">
                  <button onClick={() => confirm(t("c.confirmDelete")) && remove(f.id)} className="text-loss text-xs">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination
          page={page}
          totalPages={totalPages}
          onPage={setPage}
          labelPrev={t("c.prev")}
          labelNext={t("c.next")}
          labelPage={t("c.pageOf", { page, total: totalPages })}
        />
      </Card>
    </div>
  );
}

/** Steps a driver can plan for — Egyptian pump prices move in jumps, not drifts. */
const HIKE_STEPS = [1, 2, 3, 5];

/**
 * "What does the next price rise cost me?"
 *
 * Fuel in Egypt does not drift, it steps — and every step lands straight on
 * the driver's per-km cost. Consumption here is already measured full-to-full,
 * so the answer is arithmetic on this car's own numbers rather than a
 * forecast: litres per km × the new price, spread over the km this driver
 * really covers in a week.
 */
function FuelShockCard({
  litresPerKm,
  unitLabel,
  latestPrice,
  weeklyKm,
  kmPerHour,
  t,
  locale,
}: {
  litresPerKm: number;
  unitLabel: string;
  latestPrice: number;
  weeklyKm: number;
  kmPerHour: number;
  t: (k: string, vars?: Record<string, string | number>) => string;
  locale: string;
}) {
  // opens on a one-pound rise: the smallest step worth planning for, and it
  // makes the card answer something the moment it is on screen
  const [price, setPrice] = useState(() => Math.round((latestPrice + 1) * 100) / 100);
  const money = (n: number) => fmtMoney(n, locale);

  const nowPerKm = litresPerKm * latestPrice;
  const thenPerKm = litresPerKm * price;
  const deltaPerKm = thenPerKm - nowPerKm;
  const scale = Math.max(nowPerKm, thenPerKm) * 1.15 || 1;
  const sign = (n: number) => (n >= 0 ? "+" : "−");

  return (
    <Card className="mb-4">
      <CardHead icon="📈" title={t("fs.title")} sub={t("fs.sub", { unit: unitLabel })} />

      <div className="flex items-center gap-2 flex-wrap">
        <Btn
          variant="secondary"
          className="!px-3 !py-1.5"
          onClick={() => setPrice((p) => Math.max(0.5, Math.round((p - 0.5) * 100) / 100))}
        >
          −
        </Btn>
        <div className="text-center min-w-28">
          <div className="text-2xl font-black tnum leading-none">{money(price)}</div>
          <div className="text-[10px] text-muted mt-0.5">{t("fs.perUnit", { unit: unitLabel })}</div>
        </div>
        <Btn
          variant="secondary"
          className="!px-3 !py-1.5"
          onClick={() => setPrice((p) => Math.round((p + 0.5) * 100) / 100)}
        >
          +
        </Btn>
        <div className="flex gap-1 ms-auto">
          {HIKE_STEPS.map((step) => (
            <button
              key={step}
              onClick={() => setPrice(Math.round((latestPrice + step) * 100) / 100)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                Math.abs(price - (latestPrice + step)) < 0.001
                  ? "bg-ink border-line text-background"
                  : "bg-paper border-[var(--border)] text-ink-500 hover:bg-surface"
              }`}
            >
              +{step}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        <Meter
          ratio={nowPerKm / scale}
          tone="neutral"
          label={t("fs.nowLabel", { price: money(latestPrice) })}
          value={`${money(nowPerKm)} / ${t("c.km")}`}
        />
        <Meter
          ratio={thenPerKm / scale}
          tone={deltaPerKm <= 0 ? "good" : deltaPerKm < nowPerKm * 0.08 ? "warn" : "bad"}
          label={t("fs.thenLabel", { price: money(price) })}
          value={`${money(thenPerKm)} / ${t("c.km")}`}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-line">
        <ShockStat label={t("fs.perKm")} value={`${sign(deltaPerKm)}${money(Math.abs(deltaPerKm))}`} />
        <ShockStat
          label={t("fs.perWeek")}
          value={`${sign(deltaPerKm)}${money(Math.abs(deltaPerKm * weeklyKm))}`}
          sub={t("fs.perWeekSub", { km: fmtNum(weeklyKm, locale, 0) })}
        />
        <ShockStat
          label={t("fs.perHour")}
          value={`${sign(deltaPerKm)}${money(Math.abs(deltaPerKm * kmPerHour))}`}
          sub={t("fs.perHourSub", { kmh: fmtNum(kmPerHour, locale, 0) })}
        />
      </div>

      <p className="text-[11px] text-muted mt-3">
        {t("fs.footnote", { l: fmtNum(litresPerKm * 100, locale), unit: unitLabel })}
      </p>
    </Card>
  );
}

function ShockStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted font-semibold truncate">{label}</div>
      <div className="text-lg font-bold tnum truncate">{value}</div>
      {sub && <div className="text-[10px] text-muted truncate">{sub}</div>}
    </div>
  );
}
