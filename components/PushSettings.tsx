"use client";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "./I18nProvider";
import { Btn, Card, CardHead, IconButton, Toggle } from "./ui";
import { Icon } from "./icons";

// Phone notifications: subscribe this browser to the server's web push
// (lib/push.ts), pick what to hear about, send a test. iPhones only allow
// push for a site added to the Home Screen (iOS 16.4+), so say that plainly.

type Prefs = { week: boolean; service: boolean; target: boolean; quest: boolean; shift: boolean; bestHour: boolean };
const PREF_KEYS: (keyof Prefs)[] = ["service", "week", "target", "quest", "shift", "bestHour"];

type Support = "checking" | "ok" | "iosInstall" | "unsupported";

function detectSupport(): Support {
  if (typeof window === "undefined") return "checking";
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
  if (ios && !standalone) return "iosInstall";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return "ok";
}

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const post = (body: object) => fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export function usePush() {
  const { locale } = useI18n();
  const [support, setSupport] = useState<Support>("checking");
  const [subscribed, setSubscribed] = useState(false);
  const [denied, setDenied] = useState(false);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = detectSupport();
    setSupport(s);
    fetch("/api/push").then((r) => (r.ok ? r.json() : null)).then((d) => d && setPrefs(d.prefs));
    if (s !== "ok") return;
    setDenied(Notification.permission === "denied");
    navigator.serviceWorker.getRegistration("/").then(async (reg) => setSubscribed(!!(await reg?.pushManager.getSubscription())));
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setDenied(perm === "denied");
        return false;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      await navigator.serviceWorker.ready;
      const { publicKey } = await (await fetch("/api/push")).json();
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) }));
      const res = await post({ action: "subscribe", subscription: sub.toJSON(), locale });
      setSubscribed(res.ok);
      return res.ok;
    } finally {
      setBusy(false);
    }
  }, [locale]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await post({ action: "unsubscribe", endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }, []);

  const savePref = useCallback(
    async (k: keyof Prefs, v: boolean) => {
      setPrefs((p) => (p ? { ...p, [k]: v } : p));
      await post({ action: "prefs", prefs: { [k]: v }, locale });
    },
    [locale]
  );

  return { support, subscribed, denied, prefs, busy, enable, disable, savePref };
}

export function PushSettingsCard() {
  const { t } = useI18n();
  const { support, subscribed, denied, prefs, busy, enable, disable, savePref } = usePush();
  const [tested, setTested] = useState<string | null>(null);

  const test = async () => {
    const r = await (await post({ action: "test" })).json();
    setTested(r.sent > 0 ? t("push.testSent") : t("push.testFailed"));
  };

  return (
    <Card>
      <CardHead icon="bell" tint="tint-amber" title={t("push.title")} sub={t("push.sub")} />
      {support === "iosInstall" ? (
        <p className="text-sm leading-relaxed mt-1">{t("push.iosInstall")}</p>
      ) : support === "unsupported" ? (
        <p className="text-sm text-muted mt-1">{t("push.unsupported")}</p>
      ) : denied ? (
        <p className="text-sm leading-relaxed mt-1">{t("push.denied")}</p>
      ) : (
        <div className="mt-1 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            {subscribed ? (
              <>
                <span className="badge tint-green inline-flex items-center gap-1.5 text-sm font-bold rounded-full px-3 py-1.5">
                  <Icon name="check" size={16} /> {t("push.on")}
                </span>
                <Btn variant="secondary" onClick={test}>{t("push.test")}</Btn>
                <Btn variant="ghost" onClick={disable} disabled={busy}>{t("push.turnOff")}</Btn>
              </>
            ) : (
              <Btn onClick={enable} disabled={busy || support === "checking"}>
                <Icon name="bell" size={18} /> {t("push.turnOn")}
              </Btn>
            )}
          </div>
          {tested && <p className="text-xs text-muted">{tested}</p>}
          {prefs && (
            <div className={`space-y-3.5 ${subscribed ? "" : "opacity-60"}`}>
              {PREF_KEYS.map((k) => (
                <Toggle key={k} checked={prefs[k]} onChange={(v) => savePref(k, v)} label={t(`push.pref.${k}`)} sub={t(`push.pref.${k}.sub`)} />
              ))}
              <p className="text-xs text-muted leading-relaxed">{t("push.quiet")}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };

/** One-time nudge on the home screen; gone once notifications are on or dismissed. */
export function PushPrompt() {
  const { t } = useI18n();
  const { support, subscribed, denied, busy, enable } = usePush();
  const [hidden, setHidden] = useState(true);
  useEffect(() => setHidden(read("pushPromptHidden") === "1"), []);
  if (hidden || subscribed || denied || support === "checking" || support === "unsupported") return null;
  const dismiss = () => {
    write("pushPromptHidden", "1");
    setHidden(true);
  };
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 rounded-2xl tint-amber flex items-center justify-center shrink-0">
          <Icon name="bell" size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-[17px] leading-snug">{t("push.promptTitle")}</div>
          <p className="text-sm text-muted mt-1 leading-relaxed">{support === "iosInstall" ? t("push.iosInstall") : t("push.promptBody")}</p>
          {support === "ok" && (
            <Btn className="mt-3" onClick={async () => { if (await enable()) dismiss(); }} disabled={busy}>
              <Icon name="bell" size={18} /> {t("push.turnOnShort")}
            </Btn>
          )}
        </div>
        <IconButton name="close" label={t("c.dismiss")} onClick={dismiss} />
      </div>
    </Card>
  );
}
