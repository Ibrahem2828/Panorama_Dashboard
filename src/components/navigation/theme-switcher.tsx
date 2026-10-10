"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useI18n } from "@/i18n/provider";

export function ThemeSwitcher() {
  const { setTheme } = useTheme();
  const { t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("common.theme")}>
          <Sun className="size-4 scale-100 rotate-0 transition dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute size-4 scale-0 rotate-90 transition dark:scale-100 dark:rotate-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}><Sun />{t("common.light")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}><Moon />{t("common.dark")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}><Laptop />{t("common.system")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
