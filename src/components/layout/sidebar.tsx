"use client";

import { ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import { BrandLockup } from "@/components/brand/brand-lockup";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Locale } from "@/config/constants";
import { navigationGroups } from "@/config/navigation";
import { CONTRACT_META } from "@/contracts/generated/contract-meta";
import { usePreferences } from "@/features/preferences";
import { useSession } from "@/features/session";
import { useI18n } from "@/i18n/provider";
import { localizePath } from "@/i18n/routing";
import { hasCapability } from "@/lib/auth/capabilities";
import { cn } from "@/lib/utils";

export function SidebarContent({ onNavigate, mobile = false }: { onNavigate?: () => void; mobile?: boolean }) {
  const { t, direction } = useI18n();
  const { capabilities, user } = useSession();
  const params = useParams<{ locale: Locale }>();
  const pathname = usePathname();
  const collapsed = usePreferences((state) => state.sidebarCollapsed) && !mobile;
  const toggle = usePreferences((state) => state.toggleSidebar);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className={cn("flex h-[var(--app-topbar-height)] items-center border-b px-4", collapsed ? "justify-center" : "justify-between")}>
        <BrandLockup compact={collapsed} />
        {!mobile && !collapsed ? (
          <Button variant="ghost" size="icon" onClick={toggle} aria-label={t("sidebar.collapse")}><PanelLeftClose className="directional-icon" /></Button>
        ) : null}
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Primary navigation">
        {navigationGroups.map((group) => {
          const items = group.items.filter((item) => hasCapability(capabilities, item.capability));
          if (!items.length) return null;
          return (
            <div key={group.key} className="mb-5">
              {group.label && !collapsed ? (
                <div className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.17em] text-muted-foreground/75">{t(group.label)}</div>
              ) : null}
              <div className="space-y-1">
                {items.map((item) => {
                  const href = localizePath(params.locale, item.href);
                  const active = pathname === href || (item.href !== "/dashboard" && pathname.startsWith(`${href}/`));
                  const Icon = item.icon;
                  const link = (
                    <Link
                      key={item.key}
                      href={href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground",
                        active && "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/.12)]",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      {active ? <span className="absolute inset-y-2 start-0 w-1 rounded-e-full bg-primary" /> : null}
                      <Icon className={cn("size-[18px] shrink-0 transition-transform group-hover:scale-105", active && "text-primary")} />
                      {!collapsed ? <span className="truncate">{t(item.label)}</span> : null}
                      {!collapsed && active ? (direction === "rtl" ? <ChevronLeft className="ms-auto size-4" /> : <ChevronRight className="ms-auto size-4" />) : null}
                    </Link>
                  );
                  return collapsed ? (
                    <Tooltip key={item.key}>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side={direction === "rtl" ? "left" : "right"}>{t(item.label)}</TooltipContent>
                    </Tooltip>
                  ) : link;
                })}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="border-t p-3">
        {!collapsed ? (
          <div className="rounded-xl bg-muted/65 p-3">
            <div className="truncate text-sm font-bold">{user.full_name}</div>
            <div className="mt-1 truncate text-xs text-muted-foreground">{t(`roles.${user.role}` as "roles.admin")}</div>
            <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>API v{CONTRACT_META.version}</span>
              <span>{CONTRACT_META.operationCount} ops</span>
            </div>
          </div>
        ) : (
          <Button variant="ghost" size="icon" onClick={toggle} aria-label={t("sidebar.expand")}><PanelLeftOpen className="directional-icon" /></Button>
        )}
      </div>
    </div>
  );
}

export function DesktopSidebar() {
  const collapsed = usePreferences((state) => state.sidebarCollapsed);
  return (
    <aside className={cn("fixed inset-y-0 start-0 z-40 hidden border-e bg-card/95 backdrop-blur-xl transition-[width] duration-300 lg:block", collapsed ? "w-[var(--app-sidebar-collapsed)]" : "w-[var(--app-sidebar-expanded)]")}>
      <SidebarContent />
    </aside>
  );
}
