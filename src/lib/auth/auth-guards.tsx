"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";

import { PageLoader } from "@/components/feedback/page-loader";
import { navigationItems } from "@/config/navigation";
import { getMe } from "@/features/auth/api";
import { useAuthStore } from "@/features/auth/auth-store";
import { queryKeys } from "@/lib/api/query-keys";
import { isDashboardRole } from "@/lib/permissions";
import { getDefaultDashboardRoute, ROUTES } from "@/lib/routes";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isHydrated, hydrate, setUser, clear } = useAuthStore();
  const meQuery = useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: getMe,
    enabled: isHydrated && isAuthenticated,
    retry: false,
  });
  const verifiedUser = meQuery.data ?? null;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!isAuthenticated) {
      clear();
      router.replace(ROUTES.login);
      return;
    }

    if (meQuery.isPending) {
      return;
    }

    if (meQuery.isError || !verifiedUser || !isDashboardRole(verifiedUser.role)) {
      clear();
      router.replace(ROUTES.login);
      return;
    }

    setUser(verifiedUser);

    if (verifiedUser.role === "print_staff" && pathname === ROUTES.overview) {
      router.replace(ROUTES.printing);
      return;
    }

    const currentItem = navigationItems
      .filter((item) => item.href !== ROUTES.overview)
      .sort((a, b) => b.href.length - a.href.length)
      .find((item) => pathname.startsWith(item.href));

    if (currentItem && !currentItem.canAccess(verifiedUser.role)) {
      router.replace(getDefaultDashboardRoute(verifiedUser.role));
    }
  }, [clear, isAuthenticated, isHydrated, meQuery.isError, meQuery.isPending, pathname, router, setUser, verifiedUser]);

  if (!isHydrated || !isAuthenticated || meQuery.isPending || !verifiedUser || !isDashboardRole(verifiedUser.role)) {
    return <PageLoader label="Validating secure session" />;
  }

  return <>{children}</>;
}
