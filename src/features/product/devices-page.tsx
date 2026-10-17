"use client";

import { useQuery } from "@tanstack/react-query";
import { Ban, Bell, Smartphone, Tablet } from "lucide-react";
import { useMemo } from "react";

import type { ResourceColumn } from "@/components/data-grid/resource-table";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { Ltr } from "@/components/shared/ltr";
import { StatusPill } from "@/components/shared/status-pill";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RESOURCE_DEFINITIONS } from "@/contracts/generated/resource-definitions";
import { deviceStats, type DeviceStats } from "@/features/product/device-rules";
import { userBrief } from "@/features/governance/deletion-rules";
import { ResourceManager, type ManagerFilter, type ManagerRowAction } from "@/features/resources/resource-manager";
import { useI18n } from "@/i18n/provider";
import { apiFetch, unwrap } from "@/lib/api/browser-client";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { formatNumber } from "@/lib/utils";
import type { ApiEnvelope } from "@/types/api";

const definition = RESOURCE_DEFINITIONS.devices;
const REASON_MIN = 5;
const REASON_MAX = 500;

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</div>
        <div className="min-w-0"><div className="text-2xl font-black">{value}</div><div className="mt-1 truncate text-xs text-muted-foreground">{label}</div></div>
      </CardContent>
    </Card>
  );
}

/** Stat cards from GET devices/stats/: totals, split by platform and the most used app versions. */
function DeviceStatsPanel() {
  const { t, locale, enumLabel } = useI18n();
  const query = useQuery({
    queryKey: ["resource", "devices", "stats"],
    queryFn: async (): Promise<DeviceStats> => deviceStats(await unwrap(apiFetch<ApiEnvelope<Record<string, unknown>> | Record<string, unknown>>(`${definition.collectionPath}stats/`))),
  });
  if (query.isPending) return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)}</div>;
  if (query.isError) return <ErrorPanel error={query.error} retry={() => void query.refetch()} />;
  const stats = query.data;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("devices.stats.total")} value={formatNumber(stats.total, locale)} icon={<Smartphone className="size-5" />} />
        <StatCard label={t("devices.stats.active")} value={formatNumber(stats.active, locale)} icon={<Tablet className="size-5" />} />
        <StatCard label={t("devices.stats.revoked")} value={formatNumber(stats.revoked, locale)} icon={<Ban className="size-5" />} />
        <StatCard label={t("devices.stats.pushEnabled")} value={formatNumber(stats.pushEnabled, locale)} icon={<Bell className="size-5" />} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t("devices.stats.byPlatform")}</CardTitle></CardHeader>
          <CardContent><ul className="flex flex-wrap gap-2">{stats.byPlatform.map((item) => <li key={item.label} className="rounded-full border bg-muted/40 px-3 py-1 text-sm">{enumLabel(item.label)} <strong>{formatNumber(item.count, locale)}</strong></li>)}{!stats.byPlatform.length ? <li className="text-sm text-muted-foreground">—</li> : null}</ul></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t("devices.stats.topVersions")}</CardTitle><CardDescription className="sr-only">{t("devices.stats.topVersions")}</CardDescription></CardHeader>
          <CardContent><ul className="flex flex-wrap gap-2">{stats.topVersions.map((item) => <li key={item.label} className="rounded-full border bg-muted/40 px-3 py-1 text-sm"><Ltr as="span" className="font-mono">{item.label}</Ltr> <strong>{formatNumber(item.count, locale)}</strong></li>)}{!stats.topVersions.length ? <li className="text-sm text-muted-foreground">—</li> : null}</ul></CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Registered devices: stats, filterable table and revoke (with a recorded reason). */
export function DevicesPage() {
  const { t, enumLabel } = useI18n();
  const columns = useMemo<ResourceColumn[]>(() => [
    { key: "id", label: "#" },
    {
      key: "user",
      render: (value) => {
        const user = userBrief(value);
        if (!user) return <span className="text-muted-foreground">{t("devices.noAccount")}</span>;
        return <span className="block"><span className="font-medium">{user.name}</span><Ltr as="span" className="block text-xs text-muted-foreground">{user.email}</Ltr></span>;
      },
    },
    { key: "platform" },
    { key: "app_version" },
    { key: "build_number" },
    { key: "device_model" },
    { key: "last_seen_at" },
    { key: "notifications_enabled", render: (value) => (value ? t("common.yes") : t("common.no")) },
    { key: "is_revoked", render: (value) => <StatusPill value={value ? "revoked" : "active"} /> },
  ], [t]);
  const filters = useMemo<ManagerFilter[]>(() => [
    { param: "platform", label: t("devices.filter.platform"), options: ["android", "ios"].map((value) => ({ value, label: enumLabel(value) })) },
    { param: "revoked", label: t("devices.filter.state"), options: [{ value: "false", label: enumLabel("active") }, { value: "true", label: enumLabel("revoked") }] },
  ], [t, enumLabel]);
  const rowActions = useMemo<ManagerRowAction[]>(() => [{
    key: "revoke",
    label: t("devices.revoke"),
    icon: <Ban />,
    destructive: true,
    visible: (row) => row.is_revoked !== true,
    confirm: { title: t("devices.revokeTitle"), description: (row) => t("devices.revokeBody", { model: String(row.device_model || `#${String(row.id)}`) }), confirmLabel: t("devices.revoke") },
    reason: { label: t("devices.revokeReason"), minLength: REASON_MIN, maxLength: REASON_MAX },
    request: (row, reason) => ({ path: `${definition.collectionPath}${String(row.id)}/revoke/`, method: "POST", body: { reason } }),
  }], [t]);

  return (
    <ResourceManager
      resourceKey="devices"
      title={t("product.devices.title")}
      description={t("product.devices.subtitle")}
      eyebrow={t("nav.product")}
      capability={CAPABILITIES.product}
      columns={columns}
      filters={filters}
      rowActions={rowActions}
      extraContent={<DeviceStatsPanel />}
    />
  );
}
