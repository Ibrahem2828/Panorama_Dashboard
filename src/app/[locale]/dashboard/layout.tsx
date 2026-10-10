import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SessionBoundary } from "@/features/session";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <SessionBoundary><DashboardShell>{children}</DashboardShell></SessionBoundary>;
}
