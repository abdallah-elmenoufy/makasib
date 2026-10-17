"use client";
import { useState } from "react";
import { useI18n } from "./I18nProvider";
import { useTrackedTask } from "./ActivityIndicator";
import { Icon } from "./icons";

export function PhotoInput({
  value,
  onChange,
  onOcrDigits,
  label,
}: {
  value: string | null;
  onChange: (filename: string | null) => void;
  /** Button text; defaults to "Take a photo". */
  label?: string;
  /** When set, the photo is also OCR'd for digit runs (odometer readings). */
  onOcrDigits?: (candidates: number[]) => void;
}) {
  const { t } = useI18n();
  const track = useTrackedTask();
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    const res = await track(t("act.uploading"), () => fetch("/api/upload", { method: "POST", body: form }));
    setBusy(false);
    let filename: string | null = null;
    if (res.ok) {
      filename = (await res.json()).filename;
      onChange(filename);
    }

    if (onOcrDigits && filename) {
      setReading(true);
      try {
        // Apple Vision server OCR first (reads LCDs); tesseract fallback
        const fname = filename;
        const candidates = await track(t("act.reading"), async () => {
          const { serverOdometerCandidates, ocrOdometerCandidates } = await import("@/lib/ocr");
          let c = await serverOdometerCandidates(fname);
          if (c == null || c.length === 0) {
            // the photo is still in hand — OCR it directly; only a HEIC the
            // server converted needs the served JPEG (browsers can't decode HEIC)
            const converted = fname.split(".").pop() !== file.name.split(".").pop()?.toLowerCase();
            const blob = converted ? await fetch(`/api/files/${fname}`).then((r) => r.blob()) : file;
            c = await ocrOdometerCandidates(blob);
          }
          return c;
        });
        if (candidates.length > 0) onOcrDigits(candidates);
      } catch {
        // OCR is best-effort — the field stays manual
      } finally {
        setReading(false);
      }
    }
  };

  return (
    <div className="flex items-center gap-3">
      <label className="flex-1 min-w-0 cursor-pointer rounded-2xl border-2 border-dashed border-line-strong hover:border-action hover:bg-action-soft/50 transition-colors px-4 h-14 flex items-center gap-3">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          className="sr-only"
        />
        <span className="w-9 h-9 rounded-xl bg-action-soft text-action flex items-center justify-center shrink-0">
          <Icon name="camera" size={18} strokeWidth={2.1} />
        </span>
        <span className="text-sm font-bold truncate">{busy || reading ? (reading ? t("act.reading") : t("act.uploading")) : label ?? t("c.takePhoto")}</span>
      </label>
      {value && (
        <span className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/files/${value}`} alt={t("c.photo")} className="h-14 w-14 object-cover rounded-2xl border border-line" />
          <button type="button" onClick={() => onChange(null)} aria-label={t("c.delete")} className="absolute -top-1.5 -end-1.5 w-6 h-6 rounded-full bg-ink text-background text-xs flex items-center justify-center">
            ✕
          </button>
        </span>
      )}
    </div>
  );
}
