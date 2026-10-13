"use client";

import { UserCheck, UserX } from "lucide-react";
import { useMemo } from "react";

import type { FieldOverride } from "@/features/resources/form-schema";
import { RESOURCE_COLUMNS } from "@/features/resources/columns";
import { ResourceManager, type ManagerRowAction } from "@/features/resources/resource-manager";
import type { EntityRecord } from "@/features/resources/resource-api";
import { useSession } from "@/features/session";
import { assignableRoles, canActivateUser, canChangeRole, canDeactivateUser, canEditUser, type UserRef } from "@/features/users/user-rules";
import { useI18n } from "@/i18n/provider";
import { CAPABILITIES } from "@/lib/auth/capabilities";

const asUser = (row: EntityRecord): UserRef => ({ id: Number(row.id), role: String(row.role ?? ""), is_active: row.is_active as boolean | undefined });

export function UsersPage() {
  const { t } = useI18n();
  const { user } = useSession();
  const actor = useMemo(() => ({ id: user.id, role: user.role }), [user.id, user.role]);
  const roles = useMemo(() => assignableRoles(actor.role), [actor.role]);

  const rowActions = useMemo<ManagerRowAction[]>(() => [
    {
      key: "deactivate",
      label: t("users.deactivate"),
      icon: <UserX />,
      destructive: true,
      visible: (row) => canDeactivateUser(actor, asUser(row)),
      confirm: { title: t("users.deactivateTitle"), description: (row) => t("users.deactivateDescription", { name: String(row.full_name ?? row.email ?? row.id) }), confirmLabel: t("users.deactivate") },
      reason: { label: t("users.deactivateReason"), minLength: 3, maxLength: 255 },
      request: (row, reason) => ({ path: `/api/v1/dashboard/users/${row.id}/deactivate/`, method: "POST", body: { reason } }),
    },
    {
      key: "activate",
      label: t("users.activate"),
      icon: <UserCheck />,
      visible: (row) => canActivateUser(actor, asUser(row)),
      confirm: { title: t("users.activateTitle"), description: (row) => t("users.activateDescription", { name: String(row.full_name ?? row.email ?? row.id) }), confirmLabel: t("users.activate") },
      request: (row) => ({ path: `/api/v1/dashboard/users/${row.id}/activate/`, method: "POST" }),
    },
  ], [actor, t]);

  return (
    <ResourceManager
      resourceKey="users"
      title={t("users.title")}
      description={t("users.subtitle")}
      capability={CAPABILITIES.users}
      columns={RESOURCE_COLUMNS.users}
      allowCreate={false}
      allowDelete={false}
      canEditRow={(row) => canEditUser(actor, asUser(row))}
      formOverrides={(mode, entity): Record<string, FieldOverride> => {
        if (mode !== "edit" || !entity) return {};
        // The select must always be able to show the stored role even when the actor could not assign it.
        const options = Array.from(new Set([...roles, String(entity.role)]));
        return { role: { options, required: true, hint: "users.roleHint" } };
      }}
      disabledFields={(mode, entity) => (mode === "edit" && entity && !canChangeRole(actor, asUser(entity)) ? ["role"] : [])}
      confirmSubmit={(mode, payload, entity) => {
        if (mode !== "edit" || !("role" in payload) || !entity) return null;
        return t("users.confirmRoleChange", { name: String(entity.full_name ?? entity.email), role: t(`roles.${String(payload.role)}` as "roles.admin") });
      }}
      rowActions={rowActions}
    />
  );
}
