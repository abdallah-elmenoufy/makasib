"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "./I18nProvider";
import { VehicleSwitcher } from "./VehicleSwitcher";
import { Icon, type IconName } from "./icons";
import { Modal } from "./ui";
import { DriveFab, useDrive } from "./Drive";

// Navigation, Uber Driver-app style: on a phone a fixed bottom tab bar with
// the four screens a driver lives in plus "More"; on desktop a white sidebar.

type Item = { href: string; key: string; icon: IconName };

// sidebar order (desktop)
const TABS: Item[] = [
  { href: "/", key: "nav.home", icon: "home" },
  { href: "/shifts", key: "nav.shifts", icon: "clock" },
  { href: "/trips", key: "nav.trips", icon: "car" },
  { href: "/weeks", key: "nav.weeks", icon: "chart" },
];
// phone tab bar: two either side of the Drive button
const PHONE_LEFT: Item[] = [
  { href: "/", key: "nav.home", icon: "home" },
  { href: "/trips", key: "nav.trips", icon: "car" },
];
const PHONE_RIGHT: Item[] = [{ href: "/weeks", key: "nav.weeks", icon: "chart" }];

const GROUPS: { key: string; items: Item[] }[] = [
  {
    key: "nav.groupDrive",
    items: [
      { href: "/shifts", key: "nav.shifts", icon: "clock" },
      { href: "/plan", key: "nav.plan", icon: "map" },
      { href: "/score", key: "nav.score", icon: "bolt" },
      { href: "/import", key: "nav.import", icon: "download" },
      { href: "/income", key: "nav.income", icon: "wallet" },
    ],
  },
  {
    key: "nav.groupCar",
    items: [
      { href: "/fuel", key: "nav.fuel", icon: "fuel" },
      { href: "/maintenance", key: "nav.maintenance", icon: "wrench" },
      { href: "/expenses", key: "nav.expenses", icon: "receipt" },
      { href: "/reminders", key: "nav.reminders", icon: "bell" },
      { href: "/cars", key: "nav.cars", icon: "car" },
    ],
  },
  { key: "nav.groupApp", items: [{ href: "/settings", key: "nav.settings", icon: "settings" }] },
];

function useActions() {
  const { locale } = useI18n();
  const router = useRouter();
  const logout = async () => {
    await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    router.replace("/login");
  };
  const switchLang = async () => {
    await fetch("/api/locale", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ locale: locale === "ar" ? "en" : "ar" }) });
    location.reload();
  };
  return { logout, switchLang };
}

export function Nav() {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const { logout, switchLang } = useActions();
  const [more, setMore] = useState(false);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const inMore = GROUPS.some((g) => g.items.some((i) => isActive(i.href)));

  return (
    <>
      {/* ---------- desktop sidebar ---------- */}
      <nav className="hidden md:flex md:flex-col md:w-64 shrink-0 border-e border-line bg-sheet md:sticky md:top-0 md:h-screen md:overflow-y-auto px-3 py-4">
        <Link href="/" className="flex items-center gap-2.5 px-2 mb-5">
          <span className="w-9 h-9 rounded-xl brand-gradient text-white flex items-center justify-center text-base font-bold shadow-[var(--shadow-btn)]">م</span>
          <span className="text-xl font-bold tracking-tight">{t("appName")}</span>
        </Link>
        <VehicleSwitcher />
        <SideDriveButton />
        <div className="space-y-0.5 mt-2">
          {TABS.map((l) => (
            <SideLink key={l.href} item={l} active={isActive(l.href)} label={t(l.key)} />
          ))}
        </div>
        {GROUPS.map((g) => (
          <div key={g.key} className="mt-5">
            <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">{t(g.key)}</div>
            <div className="space-y-0.5">
              {g.items
                .filter((l) => !TABS.some((x) => x.href === l.href))
                .map((l) => (
                  <SideLink key={l.href} item={l} active={isActive(l.href)} label={t(l.key)} />
                ))}
            </div>
          </div>
        ))}
        <div className="mt-auto pt-4 border-t border-line space-y-0.5">
          <button onClick={switchLang} className="w-full flex items-center gap-3 px-3 h-11 rounded-xl text-sm text-ink-500 hover:bg-surface-2 text-start">
            <Icon name="globe" size={20} /> {locale === "ar" ? "English" : "العربية"}
          </button>
          <button onClick={logout} className="w-full flex items-center gap-3 px-3 h-11 rounded-xl text-sm text-ink-500 hover:bg-surface-2 text-start">
            <Icon name="logout" size={20} /> {t("nav.logout")}
          </button>
        </div>
      </nav>

      {/* ---------- phone top bar ---------- */}
      <header className="md:hidden sticky top-0 z-30 bg-sheet/95 backdrop-blur border-b border-line px-4 h-14 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg brand-gradient text-white flex items-center justify-center text-sm font-bold">م</span>
          <span className="text-lg font-bold tracking-tight">{t("appName")}</span>
        </Link>
        <div className="ms-auto min-w-0 max-w-[55%]">
          <VehicleSwitcher compact />
        </div>
      </header>

      {/* ---------- phone bottom tab bar ---------- */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-sheet/90 backdrop-blur-xl border-t border-line safe-bottom shadow-[0_-8px_24px_-16px_rgba(6,40,24,0.35)]">
        <div className="grid grid-cols-5 h-[var(--nav-h)]">
          {PHONE_LEFT.map((l) => (
            <TabLink key={l.href} item={l} active={isActive(l.href)} label={t(l.key)} />
          ))}
          <DriveFab />
          {PHONE_RIGHT.map((l) => (
            <TabLink key={l.href} item={l} active={isActive(l.href)} label={t(l.key)} />
          ))}
          <button onClick={() => setMore(true)} className={`flex flex-col items-center justify-center gap-1 text-[11px] font-bold ${inMore || more ? "text-action" : "text-muted"}`}>
            <span className={`w-12 h-7 rounded-full flex items-center justify-center transition-colors ${inMore || more ? "bg-action-soft" : ""}`}>
              <Icon name="grid" size={22} strokeWidth={inMore ? 2.25 : 1.75} />
            </span>
            <span>{t("nav.more")}</span>
          </button>
        </div>
      </nav>

      <Modal open={more} onClose={() => setMore(false)} title={t("nav.more")}>
        {GROUPS.map((g) => (
          <div key={g.key} className="mb-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1 px-1">{t(g.key)}</div>
            <div className="rows">
              {g.items.map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setMore(false)} className="flex items-center gap-3 min-h-14 py-3 text-[15px] font-bold">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${TINT[l.href] ?? "tint-slate"}`}>
                    <Icon name={l.icon} size={20} />
                  </span>
                  <span className="flex-1">{t(l.key)}</span>
                  <Icon name="chevron" size={18} className="text-muted-2 rtl:rotate-180" />
                </Link>
              ))}
            </div>
          </div>
        ))}
        <div className="rows border-t border-line pt-1">
          <button onClick={switchLang} className="w-full flex items-center gap-3 min-h-14 py-3 text-[15px] font-bold text-start">
            <span className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center"><Icon name="globe" size={20} /></span>
            {locale === "ar" ? "English" : "العربية"}
          </button>
          <button onClick={logout} className="w-full flex items-center gap-3 min-h-14 py-3 text-[15px] font-bold text-start text-loss">
            <span className="w-10 h-10 rounded-full bg-loss-soft flex items-center justify-center"><Icon name="logout" size={20} /></span>
            {t("nav.logout")}
          </button>
        </div>
      </Modal>
    </>
  );
}

function SideLink({ item, active, label }: { item: Item; active: boolean; label: string }) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 px-3 h-11 rounded-xl text-sm transition-colors ${
        active ? "bg-action-soft text-action font-bold" : "text-ink-700 hover:bg-surface-2 font-semibold"
      }`}
    >
      <Icon name={item.icon} size={20} strokeWidth={active ? 2.1 : 1.75} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

// each destination gets its own colour chip, so the More sheet scans fast
const TINT: Record<string, string> = {
  "/shifts": "tint-green",
  "/plan": "tint-sky",
  "/score": "tint-amber",
  "/import": "tint-violet",
  "/income": "tint-green",
  "/fuel": "tint-amber",
  "/maintenance": "tint-violet",
  "/expenses": "tint-rose",
  "/reminders": "tint-sky",
  "/cars": "tint-green",
  "/settings": "tint-slate",
};

function TabLink({ item, active, label }: { item: Item; active: boolean; label: string }) {
  return (
    <Link href={item.href} className={`flex flex-col items-center justify-center gap-1 text-[11px] font-bold ${active ? "text-action" : "text-muted"}`}>
      <span className={`w-12 h-7 rounded-full flex items-center justify-center transition-colors ${active ? "bg-action-soft" : ""}`}>
        <Icon name={item.icon} size={22} strokeWidth={active ? 2.25 : 1.75} />
      </span>
      <span className="truncate max-w-full px-1">{label}</span>
    </Link>
  );
}

function SideDriveButton() {
  const { t } = useI18n();
  const { state, open } = useDrive();
  const live = !!state?.active;
  return (
    <button type="button" onClick={() => open()} className="mt-3 w-full h-12 shrink-0 rounded-2xl brand-gradient text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[var(--shadow-btn)] hover:brightness-105 transition">
      <Icon name={live ? "plus" : "play"} size={18} strokeWidth={2.4} />
      {live ? t("tr.add") : t("sh.start")}
    </button>
  );
}
