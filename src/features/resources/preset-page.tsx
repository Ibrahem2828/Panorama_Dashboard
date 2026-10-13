"use client";

import { RESOURCE_COLUMNS } from "@/features/resources/columns";
import { ResourceManager } from "@/features/resources/resource-manager";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/messages";

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
      columns={RESOURCE_COLUMNS[resourceKey]}
      allowCreate={allowCreate}
      allowEdit={allowEdit}
      allowDelete={allowDelete}
      fieldAllowlist={fieldAllowlist}
    />
  );
}
