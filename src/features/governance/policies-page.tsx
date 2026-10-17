"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileCheck2, ScrollText, Send, Undo2 } from "lucide-react";
import { useMemo } from "react";

import { CapabilityGate } from "@/components/feedback/capability-gate";
import { PageHeader } from "@/components/shared/page-header";
import { Ltr } from "@/components/shared/ltr";
import { StatusPill } from "@/components/shared/status-pill";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RESOURCE_DEFINITIONS } from "@/contracts/generated/resource-definitions";
import { RESOURCE_COLUMNS } from "@/features/resources/columns";
import { listResource, type EntityRecord } from "@/features/resources/resource-api";
import { ResourceManager, type ManagerRowAction } from "@/features/resources/resource-manager";
import { currentVersion, safeHttpUrl } from "@/features/governance/policy-rules";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { useI18n } from "@/i18n/provider";
import { formatDate } from "@/lib/utils";

type PolicyResource = "privacy-policy-versions" | "terms-versions";

/** The version users are currently held to: the newest published among the active ones (what the backend serves). */
function CurrentVersionCard({ resourceKey }: { resourceKey: PolicyResource }) {
  const { t, locale } = useI18n();
  const query = useQuery({
    queryKey: ["resource", resourceKey, "current"],
    queryFn: () => listResource(RESOURCE_DEFINITIONS[resourceKey], { page: 1, pageSize: 100, ordering: "-published_at" }),
  });
  const current = useMemo(() => currentVersion(query.data?.results ?? []), [query.data?.results]);
  const link = current ? safeHttpUrl(current.content_url) : null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("policies.current")}</CardTitle>
        <CardDescription>{t("policies.currentHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        {query.isPending ? <Skeleton className="h-10 rounded-lg" /> : current ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <strong className="font-mono" data-testid="current-version"><Ltr as="span">{String(current.version)}</Ltr></strong>
            <StatusPill value="active" />
            <span className="text-muted-foreground">{formatDate(current.published_at, locale)}</span>
            {current.requires_reacceptance ? <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold">{t("policies.requiresReacceptance")}</span> : null}
            {link ? <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline"><ExternalLink className="size-4" />{t("policies.preview")}</a> : null}
          </div>
        ) : <p className="text-sm text-muted-foreground">{t("policies.noneActive")}</p>}
      </CardContent>
    </Card>
  );
}

function PolicyVersions({ resourceKey, title }: { resourceKey: PolicyResource; title: string }) {
  const { t } = useI18n();
  const rowActions = useMemo<ManagerRowAction[]>(() => [
    {
      key: "publish",
      label: t("policies.publish"),
      icon: <Send />,
      visible: (row) => row.is_active !== true,
      confirm: {
        title: t("policies.publishTitle"),
        description: (row: EntityRecord) => t(row.requires_reacceptance ? "policies.publishReacceptance" : "policies.publishDescription", { version: String(row.version) }),
        confirmLabel: t("policies.publish"),
      },
      request: (row) => ({ path: `${RESOURCE_DEFINITIONS[resourceKey].collectionPath}${row.id}/`, method: "PATCH", body: { is_active: true, published_at: new Date().toISOString() } }),
    },
    {
      key: "unpublish",
      label: t("policies.unpublish"),
      icon: <Undo2 />,
      destructive: true,
      visible: (row) => row.is_active === true,
      confirm: { title: t("policies.unpublishTitle"), description: (row) => t("policies.unpublishDescription", { version: String(row.version) }), confirmLabel: t("policies.unpublish") },
      request: (row) => ({ path: `${RESOURCE_DEFINITIONS[resourceKey].collectionPath}${row.id}/`, method: "PATCH", body: { is_active: false } }),
    },
  ], [resourceKey, t]);

  return (
    <ResourceManager
      resourceKey={resourceKey}
      title={title}
      capability={CAPABILITIES.product}
      columns={RESOURCE_COLUMNS[resourceKey]}
      allowDelete={false}
      createLabel={t("policies.newVersion")}
      extraContent={<CurrentVersionCard resourceKey={resourceKey} />}
      rowActions={rowActions}
      confirmSubmit={(mode, payload, entity) => {
        const publishing = payload.is_active === true || (mode === "edit" && entity?.is_active === true && "requires_reacceptance" in payload);
        if (!publishing) return null;
        const reaccept = payload.requires_reacceptance ?? entity?.requires_reacceptance;
        return t(reaccept ? "policies.publishReacceptance" : "policies.publishDescription", { version: String(payload.version ?? entity?.version ?? "") });
      }}
    />
  );
}

export function PoliciesPage() {
  const { t } = useI18n();
  return (
    <CapabilityGate capability={CAPABILITIES.product}>
      <div className="space-y-6">
        <PageHeader title={t("governance.policies.title")} description={t("governance.policies.subtitle")} eyebrow={t("nav.governance")} />
        <Tabs defaultValue="privacy" className="space-y-4">
          <TabsList><TabsTrigger value="privacy"><FileCheck2 />{t("governance.privacy")}</TabsTrigger><TabsTrigger value="terms"><ScrollText />{t("governance.terms")}</TabsTrigger></TabsList>
          <TabsContent value="privacy"><PolicyVersions resourceKey="privacy-policy-versions" title={t("governance.privacyVersions")} /></TabsContent>
          <TabsContent value="terms"><PolicyVersions resourceKey="terms-versions" title={t("governance.termsVersions")} /></TabsContent>
        </Tabs>
      </div>
    </CapabilityGate>
  );
}
