import { notFound } from "next/navigation";

import { SUPPORTED_LOCALES, type Locale } from "@/config/constants";

export function generateStaticParams() { return SUPPORTED_LOCALES.map((locale) => ({ locale })); }

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!SUPPORTED_LOCALES.includes(locale as Locale)) notFound();
  return children;
}
