"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AccessDenied } from "@/components/feedback/access-denied";
import { BackendReadinessBanner } from "@/components/layout/backend-readiness-banner";
import { DesktopSidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Skeleton } from "@/components/ui/skeleton";
import { usePreferences } from "@/features/preferences";
import { useSessionState } from "@/features/session";
import { capabilityForDashboardPath } from "@/config/navigation";
import { hasCapability } from "@/lib/auth/capabilities";
import { cn } from "@/lib/utils";

function DashboardShellSkeleton() {
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-[var(--app-sidebar-expanded)] border-e bg-card/95 lg:block">
        <div className="h-[var(--app-topbar-height)] border-b p-5"><Skeleton className="h-8 w-36" /></div>
        <div className="space-y-3 p-4">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-10 w-full rounded-xl" />)}</div>
      </aside>
      <div className="min-h-screen lg:ps-[var(--app-sidebar-expanded)]">
        <header className="sticky top-0 z-30 flex h-[var(--app-topbar-height)] items-center border-b bg-background/80 px-5 backdrop-blur-xl"><Skeleton className="ms-auto h-10 w-44 rounded-xl" /></header>
        <main className="mx-auto w-full max-w-[var(--app-content-max-width)] px-3 py-5 sm:px-5 sm:py-7 lg:px-8"><Skeleton className="h-8 w-56" /><Skeleton className="mt-4 h-52 w-full rounded-2xl" /></main>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const collapsed = usePreferences((state) => state.sidebarCollapsed);
  const { session } = useSessionState();
  const pathname = usePathname();
  if (!session) return <DashboardShellSkeleton />;
  const requiredCapability = capabilityForDashboardPath(pathname);
  if (requiredCapability && !hasCapability(session.effectiveCapabilities, requiredCapability)) return <AccessDenied />;

  return (
    <div className="min-h-screen">
      <DesktopSidebar />
      <div className={cn("min-h-screen transition-[padding] duration-300 lg:ps-[var(--app-sidebar-expanded)]", collapsed && "lg:ps-[var(--app-sidebar-collapsed)]")}>
        <Topbar />
        <BackendReadinessBanner />
        <main className="mx-auto w-full max-w-[var(--app-content-max-width)] px-3 py-5 sm:px-5 sm:py-7 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
