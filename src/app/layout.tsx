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
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", type: "image/png" }],
  },
  openGraph: { title: "Panorama Dashboard", images: [{ url: "/brand/og-image.png", width: 1200, height: 630 }] },
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
  // The proxy mints a CSP nonce per request; next-themes' inline theme script must carry it or `strict-dynamic` blocks it.
  const nonce = requestHeaders.get("x-nonce") ?? undefined;
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <AppProviders locale={locale} nonce={nonce}>{children}</AppProviders>
      </body>
    </html>
  );
}
