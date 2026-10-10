"use client";

import { Bell, LogOut, Settings, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { ConnectivityIndicator } from "@/components/layout/connectivity-indicator";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { CommandPalette } from "@/components/navigation/command-palette";
import { LanguageSwitcher } from "@/components/navigation/language-switcher";
import { ThemeSwitcher } from "@/components/navigation/theme-switcher";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Locale } from "@/config/constants";
import { useLogout, useSession } from "@/features/session";
import { CAPABILITIES, hasCapability } from "@/lib/auth/capabilities";
import { useI18n } from "@/i18n/provider";
import { localizePath } from "@/i18n/routing";

export function Topbar() {
  const { user, source, capabilities } = useSession();
  const logout = useLogout();
  const params = useParams<{ locale: Locale }>();
  const { t } = useI18n();
  const initials = user.full_name.split(/\s+/u).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return (
    <header className="sticky top-0 z-30 flex h-[var(--app-topbar-height)] items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-xl sm:px-5 lg:px-7">
      <MobileSidebar />
      <CommandPalette />
      <div className="ms-auto flex items-center gap-1 sm:gap-2">
        <ConnectivityIndicator />
        <LanguageSwitcher />
        <ThemeSwitcher />
        {hasCapability(capabilities, CAPABILITIES.announcements) ? (
          <Button variant="ghost" size="icon" asChild aria-label={t("nav.notifications")}>
            <Link href={localizePath(params.locale, "/dashboard/notifications")}><Bell /></Link>
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-11 gap-2 rounded-xl px-1.5 sm:px-2.5">
              <Avatar className="size-8 border border-primary/15"><AvatarFallback className="brand-gradient text-xs font-bold text-white">{initials || "P"}</AvatarFallback></Avatar>
              <span className="hidden min-w-0 text-start md:block">
                <span className="block max-w-40 truncate text-sm font-bold">{user.full_name}</span>
                <span className="block max-w-40 truncate text-[11px] text-muted-foreground">{t(`roles.${user.role}` as "roles.admin")}</span>
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 rounded-xl p-2">
            <DropdownMenuLabel className="space-y-1 px-3 py-2">
              <div className="truncate">{user.full_name}</div>
              <div className="truncate text-xs font-normal text-muted-foreground">{user.email}</div>
              <div className="mt-2 flex items-center gap-1.5 text-[10px] font-normal text-muted-foreground"><ShieldCheck className="size-3" />{source === "backend" ? t("session.backendCapabilities") : t("session.compatibilityCapabilities")}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link href={localizePath(params.locale, "/dashboard/settings")}><Settings />{t("nav.settings")}</Link></DropdownMenuItem>
            <DropdownMenuItem onClick={() => logout.mutate()} disabled={logout.isPending} className="text-destructive focus:text-destructive"><LogOut />{t("auth.signOut")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
