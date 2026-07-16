"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Btn, Card, Field, Input, PageTitle, Select } from "@/components/ui";

export default function SettingsPage() {
  const { t, locale } = useI18n();
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passMsg, setPassMsg] = useState("");
  const [retention, setRetention] = useState<number | "">("");
  const [retMsg, setRetMsg] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setRetention(d.photoRetentionDays ?? 30));
  }, []);

  const saveRetention = async () => {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ photoRetentionDays: retention }),
    });
    setRetMsg(res.ok ? t("c.saved") : t("c.error"));
    setTimeout(() => setRetMsg(""), 2000);
  };

  const saveLocale = async (loc: string) => {
    await fetch("/api/locale", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale: loc }),
    });
    location.reload();
  };

  const changePass = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "change", passphrase: oldPass, newPassphrase: newPass }),
    });
    setPassMsg(res.ok ? t("c.saved") : t("auth.wrong"));
    if (res.ok) {
      setOldPass("");
      setNewPass("");
    }
  };

  return (
    <div className="space-y-4">
      <PageTitle>{t("st.title")}</PageTitle>

      <Card>
        <Field label={t("st.language")}>
          <Select value={locale} onChange={(e) => saveLocale(e.target.value)} className="max-w-48">
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </Select>
        </Field>
      </Card>

      <Card>
        <div className="font-semibold text-sm mb-1">{t("st.retention")}</div>
        <p className="text-xs text-slate-400 mb-3">{t("st.retentionHint")}</p>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={1}
            max={30}
            value={retention}
            onChange={(e) => setRetention(e.target.value === "" ? "" : Number(e.target.value))}
            className="max-w-24"
          />
          <Btn onClick={saveRetention}>{t("c.save")}</Btn>
          {retMsg && <span className="text-emerald-600 text-sm">✓ {retMsg}</span>}
        </div>
      </Card>

      <Card>
        <div className="font-semibold text-sm mb-3">{t("st.changePass")}</div>
        <form onSubmit={changePass} className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg">
          <Field label={t("auth.passphrase")}>
            <Input type="password" value={oldPass} onChange={(e) => setOldPass(e.target.value)} required />
          </Field>
          <Field label={t("st.newPass")}>
            <Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} required minLength={4} />
          </Field>
          <div className="md:col-span-2 flex items-center gap-3">
            <Btn type="submit">{t("c.save")}</Btn>
            {passMsg && <span className="text-sm">{passMsg}</span>}
          </div>
        </form>
      </Card>
    </div>
  );
}
