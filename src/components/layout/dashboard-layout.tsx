"use client";

import { DesktopSidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-background">
      <DesktopSidebar />
      <div className="md:pl-72"><Topbar /><main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 lg:px-8">{children}</main></div>
    </div>
  );
}
