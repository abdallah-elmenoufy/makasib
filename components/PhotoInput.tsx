"use client";
import { useState } from "react";
import { useI18n } from "./I18nProvider";

export function PhotoInput({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (filename: string | null) => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    setBusy(false);
    if (res.ok) onChange((await res.json()).filename);
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
      {busy && <span className="text-xs text-slate-400">…</span>}
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
