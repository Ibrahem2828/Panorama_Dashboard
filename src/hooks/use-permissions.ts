"use client";

import { useCurrentUser } from "@/hooks/use-current-user";
import {
  canAccessSettings,
  canManageAcademic,
  canManageAnnouncements,
  canManageFiles,
  canManageGroups,
  canManagePrinting,
  canManageSupport,
  canManageVerification,
  canViewAuditLogs,
  canViewNotifications,
  canViewOverview,
} from "@/lib/permissions";

export function usePermissions() {
  const user = useCurrentUser();
  const role = user?.role;

  return {
    canViewOverview: canViewOverview(role),
    canManageAcademic: canManageAcademic(role),
    canManageVerification: canManageVerification(role),
    canManageGroups: canManageGroups(role),
    canManageFiles: canManageFiles(role),
    canManageAnnouncements: canManageAnnouncements(role),
    canManagePrinting: canManagePrinting(role),
    canManageSupport: canManageSupport(role),
    canViewAuditLogs: canViewAuditLogs(role),
    canViewNotifications: canViewNotifications(role),
    canAccessSettings: canAccessSettings(role),
  };
}
