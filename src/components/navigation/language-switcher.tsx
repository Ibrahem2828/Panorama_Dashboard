"use client";

import { Languages } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Locale } from "@/config/constants";
import { useI18n } from "@/i18n/provider";
import { switchLocalePath } from "@/i18n/routing";

export function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const change = (next: Locale) => {
    const query = searchParams.toString();
    router.push(`${switchLocalePath(pathname, next)}${query ? `?${query}` : ""}`);
    router.refresh();
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("common.language")}><Languages /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem onClick={() => change("ar")} className={locale === "ar" ? "bg-accent" : ""}>{t("common.arabic")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => change("en")} className={locale === "en" ? "bg-accent" : ""}>{t("common.english")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
