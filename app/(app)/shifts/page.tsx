"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { Btn, Card, Empty, Field, Input, PageTitle, Table, Textarea } from "@/components/ui";
import { useCrud, useVehicle } from "@/components/useCrud";
import { PhotoInput } from "@/components/PhotoInput";
import { fmtDateTime, fmtNum, toLocalInput, hoursBetween } from "@/lib/format";

export default function ShiftsPage() {
  const { t, locale } = useI18n();
  const { vehicle, loading: vLoading } = useVehicle();
  const { rows: shifts, loading, create, update, remove } = useCrud<any>("shifts", vehicle?.id);
  const { rows: trips } = useCrud<any>("trips", vehicle?.id);

  const active = shifts.find((s) => s.endOdometer == null);
  const tripsByShift = useMemo(() => {
    const m: Record<string, { count: number; km: number; revenue: number }> = {};
    for (const tr of trips) {
      if (!tr.shiftId) continue;
      m[tr.shiftId] ??= { count: 0, km: 0, revenue: 0 };
      m[tr.shiftId].count++;
      m[tr.shiftId].km += tr.distanceKm ?? 0;
      m[tr.shiftId].revenue += tr.fare + (tr.tip ?? 0);
    }
    return m;
  }, [trips]);

  if (vLoading || loading) return null;
  if (!vehicle) {
    return (
      <Empty>
        <Link href="/vehicle" className="text-emerald-600 underline">
          {t("veh.createFirst")}
        </Link>
      </Empty>
    );
  }

  return (
    <div>
      <PageTitle>{t("sh.title")}</PageTitle>

      {active ? (
        <EndShiftCard shift={active} onEnd={(data) => update(active.id, data)} />
      ) : (
        <StartShiftCard
          lastOdo={shifts[0]?.endOdometer ?? vehicle.initialOdometer}
          onStart={(data) => create({ ...data, vehicleId: vehicle.id })}
        />
      )}

      <Card className="mt-4">
        {shifts.filter((s) => s.endOdometer != null).length === 0 ? (
          <Empty>{t("c.noData")}</Empty>
        ) : (
          <Table
            head={[
              t("sh.startTime"),
              t("sh.duration"),
              t("sh.km"),
              t("sh.trips"),
              t("sh.tripKm"),
              t("sh.deadKm"),
              t("sh.revenue"),
              t("c.notes"),
              "",
            ]}
          >
            {shifts
              .filter((s) => s.endOdometer != null)
              .map((s) => {
                const km = s.endOdometer - s.startOdometer;
                const ts = tripsByShift[s.id] ?? { count: 0, km: 0, revenue: 0 };
                return (
                  <tr key={s.id}>
                    <td className="py-2 px-2 whitespace-nowrap">{fmtDateTime(s.startTime, locale)}</td>
                    <td className="py-2 px-2">
                      {s.endTime ? `${fmtNum(hoursBetween(s.startTime, s.endTime), locale)} ${t("c.hours")}` : "—"}
                    </td>
                    <td className="py-2 px-2 font-semibold">{fmtNum(km, locale)}</td>
                    <td className="py-2 px-2">{ts.count}</td>
                    <td className="py-2 px-2">{fmtNum(ts.km, locale)}</td>
                    <td className="py-2 px-2 text-amber-600">{fmtNum(Math.max(0, km - ts.km), locale)}</td>
                    <td className="py-2 px-2">{fmtNum(ts.revenue, locale)}</td>
                    <td className="py-2 px-2 text-slate-400 max-w-40 truncate">{s.notes ?? ""}</td>
                    <td className="py-2 px-2">
                      <button
                        onClick={() => confirm(t("c.confirmDelete")) && remove(s.id)}
                        className="text-red-400 text-xs"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
          </Table>
        )}
      </Card>
    </div>
  );
}

function StartShiftCard({
  lastOdo,
  onStart,
}: {
  lastOdo: number;
  onStart: (d: Record<string, unknown>) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [odo, setOdo] = useState("");
  const [time, setTime] = useState(toLocalInput());
  const [photo, setPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [ocrHint, setOcrHint] = useState(false);

  // pick the OCR candidate that plausibly continues from the last known reading
  const onOcrDigits = (candidates: number[]) => {
    const plausible = candidates.filter((c) => c >= lastOdo && c < lastOdo + 2000);
    const best = plausible.sort((a, b) => a - b)[0] ?? candidates[0];
    if (best != null && !odo) {
      setOdo(String(best));
      setOcrHint(true);
    }
  };

  if (!open) {
    return (
      <Btn variant="big" onClick={() => { setTime(toLocalInput()); setOpen(true); }}>
        ▶ {t("sh.start")}
      </Btn>
    );
  }

  return (
    <Card className="border-emerald-300">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await onStart({ startTime: new Date(time).toISOString(), startOdometer: odo, startPhoto: photo, notes })) {
            setOpen(false);
            setOdo("");
            setPhoto(null);
            setNotes("");
          }
        }}
        className="grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        <Field label={t("sh.startOdo")} hint={ocrHint ? `📷 ${t("sh.ocrDetected")}` : undefined}>
          <Input
            type="number"
            step="0.1"
            value={odo}
            onChange={(e) => { setOdo(e.target.value); setOcrHint(false); }}
            placeholder={String(lastOdo)}
            required
            autoFocus
          />
        </Field>
        <Field label={t("sh.startTime")}>
          <Input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} required />
        </Field>
        <Field label={`${t("c.photo")} (${t("c.optional")})`}>
          <PhotoInput value={photo} onChange={setPhoto} onOcrDigits={onOcrDigits} />
        </Field>
        <Field label={`${t("c.notes")} (${t("c.optional")})`}>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="md:col-span-2 flex gap-2">
          <Btn type="submit">▶ {t("sh.start")}</Btn>
          <Btn variant="secondary" onClick={() => setOpen(false)}>
            {t("c.cancel")}
          </Btn>
        </div>
      </form>
    </Card>
  );
}

function EndShiftCard({
  shift,
  onEnd,
}: {
  shift: any;
  onEnd: (d: Record<string, unknown>) => Promise<boolean>;
}) {
  const { t, locale } = useI18n();
  const [odo, setOdo] = useState("");
  const [time, setTime] = useState(toLocalInput());
  const [photo, setPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState(shift.notes ?? "");
  const [ocrHint, setOcrHint] = useState(false);

  const onOcrDigits = (candidates: number[]) => {
    const plausible = candidates.filter(
      (c) => c > shift.startOdometer && c < shift.startOdometer + 2000
    );
    const best = plausible.sort((a, b) => a - b)[0] ?? candidates[0];
    if (best != null && !odo) {
      setOdo(String(best));
      setOcrHint(true);
    }
  };

  return (
    <Card className="border-amber-300 bg-amber-50">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="font-semibold text-sm">
          {t("sh.active")} · {t("sh.startedAt")} {fmtDateTime(shift.startTime, locale)} ·{" "}
          {fmtNum(shift.startOdometer, locale)} {t("c.km")}
        </span>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await onEnd({
            endTime: new Date(time).toISOString(),
            endOdometer: odo,
            endPhoto: photo,
            notes,
          });
        }}
        className="grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        <Field label={t("sh.endOdo")} hint={ocrHint ? `📷 ${t("sh.ocrDetected")}` : undefined}>
          <Input
            type="number"
            step="0.1"
            value={odo}
            onChange={(e) => { setOdo(e.target.value); setOcrHint(false); }}
            min={shift.startOdometer}
            required
            autoFocus
          />
        </Field>
        <Field label={t("sh.endTime")}>
          <Input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} required />
        </Field>
        <Field label={`${t("c.photo")} (${t("c.optional")})`}>
          <PhotoInput value={photo} onChange={setPhoto} onOcrDigits={onOcrDigits} />
        </Field>
        <Field label={`${t("c.notes")} (${t("c.optional")})`}>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="md:col-span-2">
          <Btn type="submit">⏹ {t("sh.end")}</Btn>
        </div>
      </form>
    </Card>
  );
}
