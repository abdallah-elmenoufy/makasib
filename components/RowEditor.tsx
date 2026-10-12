"use client";
import { useState } from "react";
import { useI18n } from "./I18nProvider";
import { Btn, Field, Input, Modal, Select, Textarea } from "./ui";
import { toLocalInput } from "@/lib/format";

export type EditField = {
  key: string;
  label: string;
  type: "text" | "number" | "datetime" | "select" | "textarea";
  /** select only */
  options?: { value: string; label: string }[];
  step?: string;
  hint?: string;
};

/**
 * Edit form for one already-logged row (a shift, a trip, a service item).
 *
 * Rendered in a viewport-fixed sheet rather than as a row inside the table:
 * these tables are legitimately wide (a trip carries 16 columns) so they
 * scroll horizontally, and anything rendered *inside* that scroll container
 * inherits the clipping — the driver had to scroll sideways to reach their
 * own Save button. The sheet sits outside it entirely, so the whole form is
 * always on screen.
 *
 * Every field the record carries is editable here, so a driver who mistyped
 * an odometer reading or forgot a tip fixes that one value instead of
 * deleting the record and re-entering everything — deleting a shift also
 * orphans its trips, which is exactly the data damage this avoids.
 */
export function RowEditor({
  row,
  fields,
  title,
  onSave,
  onCancel,
}: {
  row: any;
  fields: EditField[];
  title?: string;
  onSave: (patch: Record<string, unknown>) => Promise<boolean>;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<Record<string, any>>(() => {
    const d: Record<string, any> = {};
    for (const f of fields) {
      const v = row[f.key];
      if (f.type === "datetime") d[f.key] = v ? toLocalInput(new Date(v)) : "";
      // stored floats can carry binary artefacts (a commission of 4.64 comes
      // back as 4.640000000000015); never show that to a driver
      else if (f.type === "number" && typeof v === "number") d[f.key] = String(Math.round(v * 10000) / 10000);
      else d[f.key] = v ?? "";
    }
    return d;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: unknown) => setDraft({ ...draft, [k]: v });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const patch: Record<string, unknown> = {};
    for (const f of fields) {
      const v = draft[f.key];
      // datetime-local has no timezone — convert back to a real instant so
      // the stored value round-trips to the same wall-clock time
      if (f.type === "datetime") patch[f.key] = v ? new Date(v).toISOString() : "";
      else patch[f.key] = v;
    }
    const ok = await onSave(patch);
    setSaving(false);
    if (ok) onCancel();
    else setError(t("c.error"));
  };

  return (
    <Modal open onClose={onCancel} title={title ?? t("c.edit")} wide>
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((f) => (
          <div key={f.key} className={f.type === "textarea" ? "md:col-span-2" : ""}>
            <Field label={f.label} hint={f.hint}>
              {f.type === "select" ? (
                <Select value={draft[f.key]} onChange={(e) => set(f.key, e.target.value)}>
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              ) : f.type === "textarea" ? (
                <Textarea value={draft[f.key]} onChange={(e) => set(f.key, e.target.value)} />
              ) : (
                <Input
                  type={f.type === "datetime" ? "datetime-local" : f.type === "number" ? "number" : "text"}
                  step={f.step}
                  value={draft[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              )}
            </Field>
          </div>
        ))}
        <div className="md:col-span-2 flex items-center gap-2 pt-1">
          <Btn type="submit" disabled={saving}>
            {saving ? "…" : t("c.save")}
          </Btn>
          <Btn variant="secondary" onClick={onCancel}>
            {t("c.cancel")}
          </Btn>
          {error && <span className="text-sm text-loss">{error}</span>}
        </div>
      </form>
    </Modal>
  );
}
