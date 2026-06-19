"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, FileCheck2, Files, LifeBuoy, Printer, Users } from "lucide-react";

import { AccessDenied } from "@/components/shared/access-denied";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OverviewCharts } from "@/features/dashboard/components/overview-charts";
import { StatsCards } from "@/features/dashboard/components/stats-cards";
import { useDashboardStats } from "@/features/dashboard/hooks";
import { normalizeApiError } from "@/lib/api/errors";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canViewOverview } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";

const quickActions = [
  { title: "Review verification requests", href: ROUTES.verification, icon: FileCheck2 },
  { title: "Create/manage groups", href: ROUTES.groups, icon: Users },
  { title: "Upload/manage files", href: ROUTES.files, icon: Files },
  { title: "View printing queue", href: ROUTES.printing, icon: Printer },
  { title: "Open support tickets", href: ROUTES.support, icon: LifeBuoy },
  { title: "Academic structure", href: ROUTES.academic, icon: BookOpen },
];

export default function DashboardOverviewPage() {
  const user = useCurrentUser();
  const statsQuery = useDashboardStats();
  const statsError = statsQuery.error ? normalizeApiError(statsQuery.error) : null;

  if (!canViewOverview(user?.role)) {
    return <AccessDenied title="Overview restricted" description="Overview is available to it_support and admin roles only. Print staff should use the Printing module." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Live operational snapshot for Panorama. Unavailable metrics show — . Restricted to it_support and admin roles."
      />
      {statsQuery.isLoading ? <LoadingState /> : null}
      {statsQuery.isError ? (
        <ErrorState message={statsError?.message ?? "Unable to load overview."} requestId={statsError?.request_id} onRetry={() => statsQuery.refetch()} />
      ) : null}
      {statsQuery.isSuccess ? (
        <>
          <StatsCards stats={statsQuery.data} />
          <OverviewCharts stats={statsQuery.data} />
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Quick actions</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Card key={action.href} className="transition-colors hover:bg-muted/40">
                    <CardContent className="flex items-center justify-between gap-4 p-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-md bg-primary/10 p-2 text-primary">
                          <Icon className="size-5" aria-hidden="true" />
                        </div>
                        <span className="text-sm font-medium">{action.title}</span>
                      </div>
                      <Button asChild variant="ghost" size="icon">
                        <Link href={action.href} aria-label={action.title}>
                          <ArrowRight />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
