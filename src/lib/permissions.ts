import type { UserRole } from "@/types/roles";

export function isDashboardRole(role?: UserRole | null) {
  return role === "it_support" || role === "admin" || role === "print_staff";
}

export function canViewOverview(role?: UserRole | null) {
  return role === "it_support" || role === "admin";
}

export function canManageAcademic(role?: UserRole | null) {
  return role === "it_support" || role === "admin";
}

export function canManageVerification(role?: UserRole | null) {
  return role === "it_support" || role === "admin";
}

export function canManageGroups(role?: UserRole | null) {
  return role === "it_support" || role === "admin";
}

export function canManageFiles(role?: UserRole | null) {
  return role === "it_support" || role === "admin";
}

export function canManageAnnouncements(role?: UserRole | null) {
  return role === "it_support" || role === "admin";
}

export function canManagePrinting(role?: UserRole | null) {
  return role === "it_support" || role === "admin" || role === "print_staff";
}

export function canManageSupport(role?: UserRole | null) {
  return role === "it_support" || role === "admin";
}

export function canViewAuditLogs(role?: UserRole | null) {
  return role === "it_support" || role === "admin";
}

export function canViewNotifications(role?: UserRole | null) {
  return role === "it_support" || role === "admin" || role === "print_staff";
}

export function canAccessSettings(role?: UserRole | null) {
  return role === "it_support" || role === "admin" || role === "print_staff";
}
