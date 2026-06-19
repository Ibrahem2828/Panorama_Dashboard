"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-background">
      <div className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-[#BFC0C2]/30 bg-card md:block">
        <Sidebar />
      </div>
      <div className="md:pl-72">
        <Topbar />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
