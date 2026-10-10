"use client";

import { StatusPill } from "@/components/shared/status-pill";
import type { ResourceColumn } from "@/components/data-grid/resource-table";
import { ResourceManager } from "@/features/resources/resource-manager";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/messages";

const commonColumns: Record<string, ResourceColumn[]> = {
  users: [
    { key: "id", label: "#" },
    { key: "full_name" },
    { key: "email" },
    { key: "role", render: (value) => <StatusPill value={value} /> },
    { key: "is_active", render: (value) => <StatusPill value={value ? "active" : "inactive"} /> },
    { key: "last_login" },
  ],
  verifications: [
    { key: "id", label: "#" }, { key: "user" }, { key: "student_number" },
    { key: "status", render: (value) => <StatusPill value={value} /> }, { key: "created_at" },
  ],
  lectures: [
    { key: "id", label: "#" }, { key: "title" }, { key: "subject" },
    { key: "processing_status", render: (value) => <StatusPill value={value} /> },
    { key: "status", render: (value) => <StatusPill value={value} /> }, { key: "created_at" },
  ],
  announcements: [
    { key: "id", label: "#" }, { key: "title" }, { key: "target_user_type" },
    { key: "is_active", render: (value) => <StatusPill value={value ? "active" : "inactive"} /> }, { key: "starts_at" }, { key: "ends_at" },
  ],
  "maintenance-modes": [
    { key: "id", label: "#" }, { key: "title_ar" }, { key: "enabled", render: (value) => <StatusPill value={value ? "enabled" : "disabled"} /> }, { key: "starts_at" }, { key: "ends_at" },
  ],
  "feature-flags": [
    { key: "id", label: "#" }, { key: "key" }, { key: "platform" }, { key: "role" }, { key: "enabled", render: (value) => <StatusPill value={value ? "enabled" : "disabled"} /> }, { key: "updated_at" },
  ],
  "mobile-release-policies": [
    { key: "id", label: "#" }, { key: "platform" }, { key: "latest_version" }, { key: "minimum_version" }, { key: "is_active", render: (value) => <StatusPill value={value ? "active" : "inactive"} /> }, { key: "updated_at" },
  ],
  "audit-logs": [
    { key: "id", label: "#" }, { key: "actor" }, { key: "action" }, { key: "target_type" }, { key: "target_id" }, { key: "created_at" },
  ],
};

export function PresetResourcePage({
  resourceKey,
  titleKey,
  subtitleKey,
  capability,
  readOnly,
  allowCreate,
  allowEdit,
  allowDelete,
  fieldAllowlist,
}: {
  resourceKey: string;
  titleKey: MessageKey;
  subtitleKey?: MessageKey;
  capability?: string;
  readOnly?: boolean;
  allowCreate?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  fieldAllowlist?: string[];
}) {
  const { t } = useI18n();
  return (
    <ResourceManager
      resourceKey={resourceKey as never}
      title={t(titleKey)}
      description={subtitleKey ? t(subtitleKey) : undefined}
      capability={capability}
      readOnly={readOnly}
      columns={commonColumns[resourceKey]}
      allowCreate={allowCreate}
      allowEdit={allowEdit}
      allowDelete={allowDelete}
      fieldAllowlist={fieldAllowlist}
    />
  );
}
