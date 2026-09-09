"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "./I18nProvider";
import { VehicleSwitcher } from "./VehicleSwitcher";

// The things a driver does constantly through a shift (start/end it, score
// incoming offers, import the day's screenshots) — always rendered as a
// fixed, large, always-visible row (never inside the scrollable link list),
// so they're never buried or require scrolling to reach.
const PRIMARY: { href: string; key: string; icon: string }[] = [
  { href: "/shifts", key: "nav.shifts", icon: "🕐" },
  { href: "/score", key: "nav.score", icon: "⚡" },
  { href: "/import", key: "nav.import", icon: "📥" },
];

const LINKS: { href: string; key: string; icon: string }[] = [
  { href: "/", key: "nav.dashboard", icon: "📊" },
  { href: "/plan", key: "nav.plan", icon: "🗓️" },
  { href: "/trips", key: "nav.trips", icon: "🚗" },
  { href: "/fuel", key: "nav.fuel", icon: "⛽" },
  { href: "/maintenance", key: "nav.maintenance", icon: "🔧" },
  { href: "/expenses", key: "nav.expenses", icon: "💸" },
  { href: "/reminders", key: "nav.reminders", icon: "🔔" },
  { href: "/cars", key: "nav.cars", icon: "🚘" },
  { href: "/settings", key: "nav.settings", icon: "⚙️" },
];

export function Nav() {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.replace("/login");
  };

  const switchLang = async () => {
    await fetch("/api/locale", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale: locale === "ar" ? "en" : "ar" }),
    });
    location.reload();
  };

  return (
    <nav
      className="md:w-60 bg-white/80 backdrop-blur-xl border-b md:border-b-0 md:border-e border-[var(--border)]
                 p-3 md:min-h-screen shrink-0 md:sticky md:top-0 md:h-screen md:overflow-y-auto"
    >
      <div className="hidden md:flex items-center gap-2 px-2 mb-5 mt-1">
        <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white text-sm font-black shadow-sm">
          م
        </span>
        <span className="text-xl font-black tracking-tight bg-gradient-to-r from-emerald-700 to-emerald-500 bg-clip-text text-transparent">
          {t("appName")}
        </span>
      </div>

      <VehicleSwitcher />

      {/* primary actions: fixed grid, not part of any scroll row — always
          fully visible the instant the app opens, on phone or desktop */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {PRIMARY.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-1 py-3 text-[11px] leading-tight
                          text-center font-bold transition-all active:scale-[0.97] ${
                            active
                              ? "bg-gradient-to-b from-emerald-600 to-emerald-700 text-white shadow-[var(--shadow-md)] ring-2 ring-emerald-500/25"
                              : "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-sm hover:from-emerald-600 hover:to-emerald-700"
                          }`}
            >
              <span className="text-lg leading-none">{l.icon}</span>
              <span className="break-words">{t(l.key)}</span>
            </Link>
          );
        })}
      </div>

      <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible scroll-x md:[scrollbar-width:none]">
        {LINKS.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all ${
                active
                  ? "bg-emerald-50 text-emerald-800 font-bold"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {active && (
                <span className="hidden md:block absolute inset-y-1.5 start-0 w-1 rounded-full bg-emerald-600" />
              )}
              <span className="text-base">{l.icon}</span>
              <span>{t(l.key)}</span>
            </Link>
          );
        })}
      </div>

      <div className="md:mt-6 mt-2 flex md:flex-col gap-1 border-t border-[var(--border)] pt-2">
        <button
          onClick={switchLang}
          className="px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800 text-start transition-colors"
        >
          🌐 {locale === "ar" ? "English" : "العربية"}
        </button>
        <button
          onClick={logout}
          className="px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-red-50 hover:text-red-700 text-start transition-colors"
        >
          🚪 {t("nav.logout")}
        </button>
      </div>
    </nav>
  );
}
