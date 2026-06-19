import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ProtectedRoute } from "@/lib/auth/auth-guards";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}
