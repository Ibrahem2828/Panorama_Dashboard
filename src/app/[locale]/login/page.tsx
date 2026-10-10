import type { Metadata } from "next";
import Image from "next/image";

import { LanguageSwitcher } from "@/components/navigation/language-switcher";
import { ThemeSwitcher } from "@/components/navigation/theme-switcher";
import type { Locale } from "@/config/constants";
import { LoginForm } from "@/features/auth/login-form";
import { getServerTranslator } from "@/i18n/server";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = getServerTranslator(locale);
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="panorama-grid pointer-events-none absolute inset-0" />
      <div className="absolute inset-x-0 top-0 z-10 flex h-16 items-center justify-end gap-1 px-4 sm:px-7"><LanguageSwitcher /><ThemeSwitcher /></div>
      <div className="relative mx-auto grid min-h-screen max-w-[1500px] lg:grid-cols-[1.1fr_.9fr]">
        <section className="relative hidden overflow-hidden p-12 lg:flex lg:flex-col lg:justify-between xl:p-16">
          <div className="absolute inset-6 rounded-[2rem] brand-gradient opacity-[0.96]" />
          <div className="absolute inset-6 overflow-hidden rounded-[2rem]">
            <div className="absolute -end-24 -top-24 size-80 rounded-full border border-white/20" />
            <div className="absolute -bottom-28 -start-20 size-96 rounded-full border border-white/15" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(255,255,255,.18),transparent_30rem)]" />
          </div>
          <div className="relative z-10 max-w-xl text-white">
            <Image src="/brand/panorama-logo.webp" alt="Panorama" width={430} height={350} priority className="h-auto w-[360px] rounded-3xl bg-white/95 p-5 shadow-2xl shadow-black/15" />
          </div>
          <div className="relative z-10 max-w-xl text-white">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-white/70">PANORAMA OPERATIONS</p>
            <h1 className="mt-4 text-4xl font-black leading-tight xl:text-5xl">{t("app.tagline")}</h1>
            <p className="mt-5 max-w-lg text-base leading-8 text-white/78">{t("dashboard.subtitle")}</p>
            <div className="mt-8 grid grid-cols-3 gap-3 text-center text-xs">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur"><div className="text-xl font-black">AR / EN</div><div className="mt-1 text-white/70">RTL + LTR</div></div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur"><div className="text-xl font-black">BFF</div><div className="mt-1 text-white/70">HttpOnly</div></div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur"><div className="text-xl font-black">RBAC</div><div className="mt-1 text-white/70">Capabilities</div></div>
            </div>
          </div>
        </section>
        <section className="flex items-center justify-center px-4 py-24 sm:px-8 lg:px-12">
          <div className="glass-panel w-full max-w-md rounded-[1.75rem] border p-6 sm:p-9">
            <div className="mb-8 lg:hidden"><Image src="/brand/panorama-logo.webp" alt="Panorama" width={330} height={250} priority className="mx-auto h-auto w-64" /></div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">{t("app.name")}</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">{t("auth.welcome")}</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{t("auth.subtitle")}</p>
            <div className="mt-8"><LoginForm /></div>
          </div>
        </section>
      </div>
    </main>
  );
}
