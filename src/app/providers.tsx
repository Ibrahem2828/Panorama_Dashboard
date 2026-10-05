"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";

import type { Locale } from "@/config/constants";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePreferences } from "@/features/preferences";
import { I18nProvider } from "@/i18n/provider";
import { createQueryClient } from "@/lib/api/query-client";

function PreferenceEffects() {
  const reduceMotion = usePreferences((state) => state.reduceMotion);
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
  }, [reduceMotion]);
  return null;
}

export function AppProviders({ locale, children }: { locale: Locale; children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <I18nProvider locale={locale}>
          <TooltipProvider delayDuration={180}>
            <PreferenceEffects />
            {children}
            <Toaster richColors closeButton position={locale === "ar" ? "top-left" : "top-right"} />
          </TooltipProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
