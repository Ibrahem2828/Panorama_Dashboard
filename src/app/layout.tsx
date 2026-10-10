import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";

import { AppProviders } from "@/app/providers";
import { normalizeLocale } from "@/i18n/server";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: { default: "Panorama Dashboard", template: "%s | Panorama" },
  description: "Secure bilingual operations dashboard for Panorama student services.",
  applicationName: "Panorama Dashboard",
  icons: {
    icon: [{ url: "/brand/panorama-icon-128.png", type: "image/png" }],
    apple: [{ url: "/brand/panorama-icon.png", type: "image/png" }],
  },
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#090d1a" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const locale = normalizeLocale(requestHeaders.get("x-panorama-locale") ?? undefined);
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <AppProviders locale={locale}>{children}</AppProviders>
      </body>
    </html>
  );
}
