"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import { toast } from "sonner";

import { AccessDenied } from "@/components/feedback/access-denied";
import { PageLoader } from "@/components/feedback/page-loader";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/config/constants";
import { useI18n } from "@/i18n/provider";
import { bffFetch, unwrap } from "@/lib/api/browser-client";
import { AppApiError } from "@/lib/api/errors";
import { hasCapability } from "@/lib/auth/capabilities";
import type { ApiEnvelope } from "@/types/api";
import type { DashboardSession } from "@/types/auth";

export type DashboardSessionStatus = "loading" | "authenticated" | "unauthenticated" | "forbidden" | "backend_unavailable";

interface SessionState {
  session: DashboardSession | null;
  status: DashboardSessionStatus;
  isPending: boolean;
  isError: boolean;
}

const SessionContext = createContext<SessionState>({
  session: null,
  status: "loading",
  isPending: true,
  isError: false,
});

export function useSessionQuery() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => unwrap(await bffFetch<ApiEnvelope<DashboardSession>>("/api/auth/session")),
    staleTime: 60_000,
    retry: false,
  });
}

function sessionStatus(query: ReturnType<typeof useSessionQuery>): DashboardSessionStatus {
  if (query.isPending) return "loading";
  if (query.data) return "authenticated";
  const status = query.error instanceof AppApiError ? query.error.status : 503;
  if (status === 401) return "unauthenticated";
  if (status === 403) return "forbidden";
  return "backend_unavailable";
}

export function useLogin() {
  const router = useRouter();
  const params = useParams<{ locale: Locale }>();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: { identifier: string; password: string }) =>
      unwrap(await bffFetch<ApiEnvelope<DashboardSession>>("/api/auth/login", { method: "POST", body: values })),
    onSuccess(session) {
      queryClient.setQueryData(["session"], session);
      const requested = searchParams.get("returnTo");
      const safeReturnTo = requested?.startsWith(`/${params.locale}/dashboard`) && !requested.includes("//")
        ? requested
        : `/${params.locale}/dashboard`;
      router.replace(safeReturnTo);
      router.refresh();
    },
    onError(error: Error) {
      toast.error(error.message);
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const params = useParams<{ locale: Locale }>();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => bffFetch("/api/auth/logout", { method: "POST" }),
    onSettled() {
      queryClient.clear();
      router.replace(`/${params.locale}/login`);
      router.refresh();
    },
  });
}

function ServiceUnavailable({ retrying, onRetry, requestId }: { retrying: boolean; onRetry: () => void; requestId?: string }) {
  const { t } = useI18n();
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <section className="max-w-md space-y-4 rounded-2xl border bg-card p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-muted-foreground">{t("errors.503")}</p>
        <h1 className="text-2xl font-bold">{t("session.unavailableTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("session.unavailableDescription")}</p>
        {requestId ? <p className="font-mono text-xs text-muted-foreground" dir="ltr">{t("common.requestId")}: {requestId}</p> : null}
        <Button onClick={onRetry} disabled={retrying}>{t("session.retryCheck")}</Button>
      </section>
    </main>
  );
}

/**
 * Session truth is the same-origin BFF endpoint. Dashboard children are not
 * rendered until it resolves, preventing protected queries from firing during
 * the loading state or against a rejected session.
 */
export function SessionBoundary({ children }: { children: ReactNode }) {
  const query = useSessionQuery();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ locale: Locale }>();
  const status = sessionStatus(query);

  useEffect(() => {
    if (status !== "unauthenticated") return;
    const returnTo = encodeURIComponent(pathname);
    router.replace(`/${params.locale}/login?returnTo=${returnTo}`);
  }, [params.locale, pathname, router, status]);

  if (status === "loading" || status === "unauthenticated") {
    return <PageLoader label="Validating secure session" />;
  }
  if (status === "forbidden") return <AccessDenied />;
  if (status === "backend_unavailable") {
    const requestId = query.error instanceof AppApiError ? query.error.requestId : undefined;
    return <ServiceUnavailable retrying={query.isFetching} onRetry={() => void query.refetch()} requestId={requestId} />;
  }

  return (
    <SessionContext.Provider value={{ session: query.data ?? null, status, isPending: false, isError: false }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionState() {
  return useContext(SessionContext);
}

export function useSession() {
  const { session } = useSessionState();
  if (!session) throw new Error("useSession must be used after a validated session.");
  return session;
}

export function useCan(capability?: string) {
  const { session } = useSessionState();
  return hasCapability(session?.effectiveCapabilities, capability);
}
