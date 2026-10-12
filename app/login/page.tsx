"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { Btn, Card, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [setup, setSetup] = useState<boolean | null>(null);
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        if (d.authed) router.replace("/");
        else setSetup(d.setup);
      });
  }, [router]);

  const switchLang = async () => {
    await fetch("/api/locale", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale: locale === "ar" ? "en" : "ar" }),
    });
    location.reload();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (setup === false && pass !== confirm) {
      setError(t("auth.mismatch"));
      return;
    }
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: setup ? "login" : "setup", passphrase: pass }),
    });
    if (res.ok) router.replace("/");
    else setError(t("auth.wrong"));
  };

  if (setup === null) return null;

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-3xl font-black text-ink">{t("appName")}</div>
          <div className="text-sm text-muted mt-1">{t("tagline")}</div>
        </div>
        {setup === false && (
          <p className="text-sm text-ink-500 mb-4 text-center">{t("auth.setupTitle")}</p>
        )}
        <form onSubmit={submit} className="space-y-3">
          <Field label={t("auth.passphrase")}>
            <Input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoFocus
              required
              minLength={4}
            />
          </Field>
          {setup === false && (
            <Field label={t("auth.confirm")}>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </Field>
          )}
          {error && <p className="text-loss text-sm">{error}</p>}
          <Btn type="submit" variant="big">
            {setup ? t("auth.login") : t("auth.setupBtn")}
          </Btn>
        </form>
        <button onClick={switchLang} className="mt-4 text-xs text-muted hover:text-ink-500 w-full">
          {locale === "ar" ? "English" : "العربية"}
        </button>
      </Card>
    </main>
  );
}
