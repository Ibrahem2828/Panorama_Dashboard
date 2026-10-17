import Link from "next/link";

import { DEFAULT_LOCALE } from "@/config/constants";
import { getServerTranslator } from "@/i18n/server";

export default function NotFound() {
  const t = getServerTranslator(DEFAULT_LOCALE);
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="text-center"><div className="brand-text-gradient text-8xl font-black">404</div><h1 className="mt-4 text-2xl font-bold">{t("notFound.title")}</h1><Link href="/ar/login" className="mt-6 inline-block rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">{t("notFound.back")}</Link></div>
    </main>
  );
}
