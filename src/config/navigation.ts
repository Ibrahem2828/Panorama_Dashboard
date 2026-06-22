import {
  Bell,
  BookOpen,
  ClipboardList,
  FileCheck2,
  FileText,
  GraduationCap,
  Home,
  LifeBuoy,
  Printer,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";

import {
  canAccessSettings,
  canManageAcademic,
  canManageAnnouncements,
  canManageFiles,
  canManageGroups,
  canManagePrinting,
  canManageSupport,
  canManageVerification,
  canManageStudentAccountRequests,
  canViewAuditLogs,
  canViewNotifications,
  canViewOverview,
} from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import type { UserRole } from "@/types/roles";

export interface NavigationItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  canAccess: (role?: UserRole | null) => boolean;
}

export const navigationItems: NavigationItem[] = [
  { label: "Overview", href: ROUTES.overview, icon: Home, canAccess: canViewOverview },
  { label: "Academic Structure", href: ROUTES.academic, icon: GraduationCap, canAccess: canManageAcademic },
  { label: "Verification Requests", href: ROUTES.verification, icon: FileCheck2, canAccess: canManageVerification },
  { label: "طلبات حسابات الطلاب", href: ROUTES.studentAccountRequests, icon: ClipboardList, canAccess: canManageStudentAccountRequests },
  { label: "Groups", href: ROUTES.groups, icon: Users, canAccess: canManageGroups },
  { label: "Files Library", href: ROUTES.files, icon: BookOpen, canAccess: canManageFiles },
  { label: "Announcements", href: ROUTES.announcements, icon: FileText, canAccess: canManageAnnouncements },
  { label: "Printing Orders", href: ROUTES.printing, icon: Printer, canAccess: canManagePrinting },
  { label: "Support Tickets", href: ROUTES.support, icon: LifeBuoy, canAccess: canManageSupport },
  { label: "Audit Logs", href: ROUTES.auditLogs, icon: ScrollText, canAccess: canViewAuditLogs },
  { label: "Notifications", href: ROUTES.notifications, icon: Bell, canAccess: canViewNotifications },
  { label: "Settings", href: ROUTES.settings, icon: Settings, canAccess: canAccessSettings },
];

// Bilingual Arabic labels available for future i18n or tooltips (RTL friendly layout)
export const navigationArabic: Record<string, string> = {
  [ROUTES.overview]: "نظرة عامة",
  [ROUTES.academic]: "الهيكل الأكاديمي",
  [ROUTES.verification]: "طلبات التحقق",
  [ROUTES.studentAccountRequests]: "طلبات حسابات الطلاب",
  [ROUTES.groups]: "المجموعات",
  [ROUTES.files]: "مكتبة الملفات",
  [ROUTES.announcements]: "الإعلانات",
  [ROUTES.printing]: "أوامر الطباعة",
  [ROUTES.support]: "تذاكر الدعم",
  [ROUTES.auditLogs]: "سجلات التدقيق",
  [ROUTES.notifications]: "الإشعارات",
  [ROUTES.settings]: "الإعدادات",
};
