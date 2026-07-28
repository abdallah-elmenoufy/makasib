"use client";
import { useState } from "react";
import { useI18n } from "./I18nProvider";
import { useTrackedTask } from "./ActivityIndicator";

export function PhotoInput({
  value,
  onChange,
  onOcrDigits,
}: {
  value: string | null;
  onChange: (filename: string | null) => void;
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
            const served = await fetch(`/api/files/${fname}`).then((r) => r.blob());
            c = await ocrOdometerCandidates(served);
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
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        className="text-xs"
      />
      {(busy || reading) && <span className="text-xs text-slate-400 animate-pulse">…</span>}
      {value && (
        <span className="flex items-center gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/files/${value}`} alt={t("c.photo")} className="h-10 w-10 object-cover rounded" />
          <button type="button" onClick={() => onChange(null)} className="text-red-400 text-xs">
            ✕
          </button>
        </span>
      )}
    </div>
  );
}
