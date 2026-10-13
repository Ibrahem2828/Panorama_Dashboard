"use client";

import { ToggleLeft, ToggleRight } from "lucide-react";
import { useMemo } from "react";

import { RESOURCE_DEFINITIONS } from "@/contracts/generated/resource-definitions";
import { RESOURCE_COLUMNS } from "@/features/resources/columns";
import { ResourceManager, type ManagerRowAction } from "@/features/resources/resource-manager";
import { validateReleasePolicy } from "@/features/product/release-rules";
import { useI18n } from "@/i18n/provider";
import { CAPABILITIES } from "@/lib/auth/capabilities";

export function FeatureFlagsPage() {
  const { t } = useI18n();
  const rowActions = useMemo<ManagerRowAction[]>(() => {
    const path = (id: unknown) => `${RESOURCE_DEFINITIONS["feature-flags"].collectionPath}${String(id)}/`;
    return [
      {
        key: "enable",
        label: t("flags.enable"),
        icon: <ToggleRight />,
        visible: (row) => row.enabled !== true,
        confirm: { title: t("flags.enableTitle"), description: (row) => t("flags.enableDescription", { key: String(row.key) }), confirmLabel: t("flags.enable") },
        request: (row) => ({ path: path(row.id), method: "PATCH", body: { enabled: true } }),
      },
      {
        key: "disable",
        label: t("flags.disable"),
        icon: <ToggleLeft />,
        destructive: true,
        visible: (row) => row.enabled === true,
        confirm: { title: t("flags.disableTitle"), description: (row) => t("flags.disableDescription", { key: String(row.key) }), confirmLabel: t("flags.disable") },
        request: (row) => ({ path: path(row.id), method: "PATCH", body: { enabled: false } }),
      },
    ];
  }, [t]);
  return (
    <ResourceManager
      resourceKey="feature-flags"
      title={t("product.features.title")}
      description={t("product.features.subtitle")}
      capability={CAPABILITIES.product}
      columns={RESOURCE_COLUMNS["feature-flags"]}
      allowDelete={false}
      createLabel={t("flags.create")}
      rowActions={rowActions}
    />
  );
}

export function ReleasePoliciesPage() {
  const { t } = useI18n();
  return (
    <ResourceManager
      resourceKey="mobile-release-policies"
      title={t("product.releases.title")}
      description={t("product.releases.subtitle")}
      capability={CAPABILITIES.product}
      columns={RESOURCE_COLUMNS["mobile-release-policies"]}
      allowDelete={false}
      createLabel={t("releases.create")}
      guardSubmit={(_mode, payload, entity, rows) => validateReleasePolicy(payload, entity, rows)}
      confirmSubmit={(_mode, payload, entity) => {
        const merged = { ...(entity ?? {}), ...payload };
        const touchesForce = "update_mode" in payload || "is_active" in payload || "minimum_supported_build" in payload;
        return merged.update_mode === "required" && merged.is_active !== false && touchesForce ? t("releases.confirmRequired", { platform: String(merged.platform ?? "") }) : null;
      }}
    />
  );
}
