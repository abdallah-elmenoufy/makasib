"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "./I18nProvider";

// The two things a driver does every single shift — always rendered as a
// fixed, large, always-visible pair (never inside the scrollable link row),
// so they're never buried or require scrolling to reach.
const PRIMARY: { href: string; key: string; icon: string }[] = [
  { href: "/shifts", key: "nav.shifts", icon: "🕐" },
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
  { href: "/vehicle", key: "nav.vehicle", icon: "🚘" },
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
    <nav className="md:w-56 bg-white border-b md:border-b-0 md:border-e border-slate-200 p-3 md:min-h-screen shrink-0">
      <div className="hidden md:block text-2xl font-black text-emerald-600 px-2 mb-4">
        {t("appName")}
      </div>

      {/* primary actions: fixed grid, not part of any scroll row — always
          fully visible the instant the app opens, on phone or desktop */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {PRIMARY.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-sm font-bold transition-colors ${
              pathname === l.href
                ? "bg-emerald-700 text-white ring-2 ring-emerald-300"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            <span className="text-lg">{l.icon}</span>
            <span>{t(l.key)}</span>
          </Link>
        ))}
      </div>

      <div className="flex md:flex-col gap-1 overflow-x-auto">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
              pathname === l.href
                ? "bg-emerald-50 text-emerald-700 font-semibold"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>{l.icon}</span>
            <span>{t(l.key)}</span>
          </Link>
        ))}
      </div>
      <div className="md:mt-6 mt-2 flex md:flex-col gap-1 border-t border-slate-100 pt-2">
        <button
          onClick={switchLang}
          className="px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 text-start"
        >
          🌐 {locale === "ar" ? "English" : "العربية"}
        </button>
        <button
          onClick={logout}
          className="px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 text-start"
        >
          🚪 {t("nav.logout")}
        </button>
      </div>
    </nav>
  );
}
