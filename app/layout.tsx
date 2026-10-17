import type { Metadata } from "next";
import "@fontsource-variable/readex-pro";
import "./globals.css";
import { getT } from "@/lib/i18n/server";
import { I18nProvider } from "@/components/I18nProvider";

export const metadata: Metadata = {
  title: "Makasib — Driver Profit Tracker",
  description: "Know your real profit, not just your earnings",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Makasib",
    statusBarStyle: "default",
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f5f3" },
    { media: "(prefers-color-scheme: dark)", color: "#08100c" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

// Applies the driver's saved theme before first paint, so a dark-mode user
// never sees a white flash. "system" leaves the attribute off and lets the
// OS setting (prefers-color-scheme) decide — see app/globals.css.
const THEME_BOOT = `try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dir } = await getT();
  return (
    <html lang={locale} dir={dir} className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-ink">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
