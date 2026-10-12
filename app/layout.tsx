import type { Metadata } from "next";
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
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dir } = await getT();
  return (
    <html lang={locale} dir={dir} className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white text-ink">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
