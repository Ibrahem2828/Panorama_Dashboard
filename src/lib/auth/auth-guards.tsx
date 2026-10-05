"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { PageLoader } from "@/components/feedback/page-loader";
import { useSessionQuery } from "@/features/session";
import { getDefaultDashboardRoute, ROUTES } from "@/lib/routes";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSessionQuery();
  useEffect(() => {
    const user = session.data?.user;
    if (session.isError || (!session.isPending && !user)) router.replace(ROUTES.login);
    else if (user?.role === "print_staff" && pathname === ROUTES.overview) router.replace(ROUTES.printing);
    else if (user && !pathname.startsWith(getDefaultDashboardRoute(user.role))) router.replace(getDefaultDashboardRoute(user.role));
  }, [pathname, router, session.data?.user, session.isError, session.isPending]);
  if (session.isPending || !session.data) return <PageLoader label="Validating secure session" />;
  return <>{children}</>;
}
