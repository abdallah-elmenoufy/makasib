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
  Input,
  Meter,
  PageTitle,
  Pagination,
  Select,
  StackedMeter,
  Table,
  Textarea,
} from "@/components/ui";
import { EXPENSE_ICON, QuickExpense } from "@/components/QuickExpense";
import { useCrud } from "@/components/useCrud";
import { useVehicle } from "@/components/VehicleProvider";
import { fmtDate, fmtMoney, fmtNum, toLocalInput } from "@/lib/format";

const CATEGORIES = ["WASH", "FINE", "PARKING", "MOBILE_DATA", "RENTAL", "INSURANCE", "LICENSE", "TOLL", "OTHER"];

/** One colour per category, shared by the split bar and its legend. */
const CAT_COLOR: Record<string, string> = {
  WASH: "#2a78d6",
  FINE: "#e34948",
  PARKING: "#7b61c9",
  MOBILE_DATA: "#eda100",
  RENTAL: "#d97706",
  INSURANCE: "#0891b2",
  LICENSE: "#6b7280",
  TOLL: "var(--money)",
  OTHER: "var(--muted-2)",
};

const empty = () => ({
  date: toLocalInput(),
  category: "WASH",
  amount: "",
  odometer: "",
  isWork: true,
  notes: "",
});

export default function ExpensesPage() {
  const { t, locale } = useI18n();
  const { vehicle, loading: vLoading } = useVehicle();
  const { rows, loading, create, remove, refresh, page, setPage, totalPages } = useCrud<any>(
    "expenses",
    vehicle?.id
  );
  const [form, setForm] = useState<any>(empty());
  const [open, setOpen] = useState(false);
  // the table is paginated; the totals and the "last amount" the quick chips
  // remember both need every row
  const [allRows, setAllRows] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    if (!vehicle) return;
    fetch(`/api/expenses?vehicleId=${vehicle.id}&all=1`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setAllRows(Array.isArray(d) ? d : []));
    fetch(`/api/analytics?vehicleId=${vehicle.id}&period=all`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setAnalytics);
  }, [vehicle, rows]);

  const totals = useMemo(() => {
    const byCat = new Map<string, { amount: number; count: number }>();
    let work = 0;
    let personal = 0;
    for (const x of allRows) {
      if (x.isWork) {
        work += x.amount;
        const e = byCat.get(x.category) ?? { amount: 0, count: 0 };
        e.amount += x.amount;
        e.count += 1;
        byCat.set(x.category, e);
      } else {
        personal += x.amount;
      }
    }
    return {
      work,
      personal,
      byCat: CATEGORIES.filter((c) => byCat.has(c))
        .map((c) => ({ key: c, ...byCat.get(c)! }))
        .sort((a, b) => b.amount - a.amount),
    };
  }, [allRows]);

  if (vLoading || loading) return null;
  if (!vehicle) {
    return (
      <Empty>
        <Link href="/cars" className="text-action underline">
          {t("veh.createFirst")}
        </Link>
      </Empty>
    );
  }
  const set = (k: string, v: unknown) => setForm({ ...form, [k]: v });

  const money = (n: number) => fmtMoney(n, locale);
  const netRevenue: number | null = analytics?.earnings?.netRevenue ?? null;
  const shiftDays: number = analytics?.counts?.shiftDays ?? 0;
  const share = netRevenue != null && netRevenue > 0 ? totals.work / netRevenue : null;

  return (
    <div>
      <PageTitle>{t("ex.title")}</PageTitle>

      <Card className="mb-4">
        <CardHead icon="💸" title={t("ex.summaryTitle")} sub={t("ex.summarySub")} />

        {allRows.length === 0 ? (
          <p className="text-xs text-warn-ink bg-warn-soft border border-warn/60 rounded-lg px-3 py-2 mb-3">
            ⚠️ {t("ex.emptyWarning")}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted font-semibold">
                  {t("ex.totalWork")}
                </div>
                <div className="text-3xl font-black tnum mt-0.5 leading-tight">{money(totals.work)}</div>
                <div className="text-xs text-muted mt-1">
                  {t("ex.entries", { n: fmtNum(allRows.length, locale, 0) })}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted font-semibold">
                  {t("ex.perShiftDay")}
                </div>
                <div className="text-3xl font-black tnum mt-0.5 leading-tight">
                  {shiftDays > 0 ? money(totals.work / shiftDays) : "—"}
                </div>
                <div className="text-xs text-muted mt-1">
                  {t("ex.overDays", { n: fmtNum(shiftDays, locale, 0) })}
                </div>
              </div>
              {totals.personal > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted font-semibold">
                    {t("ex.personalTotal")}
                  </div>
                  <div className="text-2xl font-black tnum mt-0.5 leading-tight text-muted">
                    {money(totals.personal)}
                  </div>
                  <div className="text-xs text-muted mt-1">{t("ex.personalSub")}</div>
                </div>
              )}
            </div>

            {totals.byCat.length > 0 && (
              <div className="mt-5 pt-4 border-t border-line">
                <div className="text-xs font-semibold text-ink-500 mb-2">{t("ex.byCategory")}</div>
                <StackedMeter
                  segments={totals.byCat.map((c) => ({
                    key: c.key,
                    value: c.amount,
                    color: CAT_COLOR[c.key],
                    label: t(`ex.cat.${c.key}`),
                  }))}
                />
                <div className="mt-2 space-y-1">
                  {totals.byCat.map((c) => (
                    <div key={c.key} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: CAT_COLOR[c.key] }} />
                      <span className="flex-1 text-ink-500">
                        {EXPENSE_ICON[c.key]} {t(`ex.cat.${c.key}`)}
                      </span>
                      <span className="text-muted tnum">{t("ex.entries", { n: c.count })}</span>
                      <span className="font-semibold tnum w-24 text-end">{money(c.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {share != null && (
              <div className="mt-5 pt-4 border-t border-line">
                <Meter
                  ratio={share}
                  tone={share <= 0.08 ? "good" : share <= 0.15 ? "warn" : "bad"}
                  label={t("ex.shareOfEarnings")}
                  value={`${fmtNum(share * 100, locale, 1)}%`}
                  sub={t("ex.shareOfEarningsSub", { spend: money(totals.work), revenue: money(netRevenue!) })}
                />
              </div>
            )}
          </>
        )}

        <div className="mt-4 pt-4 border-t border-line">
          <div className="text-xs font-semibold text-ink-500 mb-2">{t("qx.title")}</div>
          <QuickExpense vehicleId={vehicle.id} recent={allRows} onAdded={refresh} />
        </div>
      </Card>

      <AddPanel buttonLabel={t("ex.add")} open={open} setOpen={setOpen}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await create({ ...form, vehicleId: vehicle.id, date: new Date(form.date).toISOString() })) {
              setForm(empty());
              setOpen(false);
            }
          }}
          className="grid grid-cols-2 md:grid-cols-3 gap-3"
        >
          <Field label={t("c.date")}>
            <Input type="datetime-local" value={form.date} onChange={(e) => set("date", e.target.value)} required />
          </Field>
          <Field label={t("ex.category")}>
            <Select value={form.category} onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`ex.cat.${c}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("ex.amount")}>
            <Input type="number" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} required />
          </Field>
          <Field label={`${t("c.odometer")} (${t("c.optional")})`}>
            <Input type="number" step="0.1" value={form.odometer} onChange={(e) => set("odometer", e.target.value)} />
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox label={t("ex.isWork")} checked={form.isWork} onChange={(v) => set("isWork", v)} />
          </div>
          <div className="col-span-2 md:col-span-3">
            <Field label={`${t("c.notes")} (${t("c.optional")})`}>
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
          <Table head={[t("c.date"), t("ex.category"), t("ex.amount"), t("ex.isWork"), t("c.notes"), ""]}>
            {rows.map((x) => (
              <tr key={x.id}>
                <td className="py-2 px-2 whitespace-nowrap">{fmtDate(x.date, locale)}</td>
                <td className="py-2 px-2">
                  {EXPENSE_ICON[x.category]} {t(`ex.cat.${x.category}`)}
                </td>
                <td className="py-2 px-2 font-semibold">{fmtMoney(x.amount, locale)}</td>
                <td className="py-2 px-2">{x.isWork ? "✓" : "—"}</td>
                <td className="py-2 px-2 text-muted max-w-40 truncate">{x.notes ?? ""}</td>
                <td className="py-2 px-2">
                  <button onClick={() => confirm(t("c.confirmDelete")) && remove(x.id)} className="text-loss text-xs">
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
