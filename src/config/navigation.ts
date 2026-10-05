import {
  Activity,
  BellRing,
  BookOpenCheck,
  Building2,
  ClipboardCheck,
  FileCheck2,
  FileStack,
  Flag,
  GraduationCap,
  Headphones,
  LayoutDashboard,
  Megaphone,
  MessageSquareText,
  MonitorSmartphone,
  Network,
  NotebookTabs,
  Printer,
  ScrollText,
  Settings,
  ShieldCheck,
  Smartphone,
  Tags,
  University,
  UserRoundCog,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { CAPABILITIES } from "@/lib/auth/capabilities";
import type { MessageKey } from "@/i18n/messages";

export interface NavigationItem {
  key: string;
  label: MessageKey;
  href: string;
  icon: LucideIcon;
  capability?: string;
  keywords?: string[];
}

export interface NavigationGroup {
  key: string;
  label?: MessageKey;
  items: NavigationItem[];
}

export const navigationGroups: NavigationGroup[] = [
  {
    key: "overview",
    items: [
      { key: "overview", label: "nav.overview", href: "/dashboard", icon: LayoutDashboard, capability: CAPABILITIES.dashboard },
    ],
  },
  {
    key: "administration",
    label: "nav.administration",
    items: [
      { key: "users", label: "nav.users", href: "/dashboard/users", icon: Users, capability: CAPABILITIES.users },
      { key: "rbac", label: "nav.rbac", href: "/dashboard/rbac", icon: ShieldCheck, capability: CAPABILITIES.users },
      { key: "academic", label: "nav.academic", href: "/dashboard/academic", icon: GraduationCap, capability: CAPABILITIES.academic },
      { key: "verifications", label: "nav.verifications", href: "/dashboard/verifications", icon: ClipboardCheck, capability: CAPABILITIES.verification },
    ],
  },
  {
    key: "content",
    label: "nav.content",
    items: [
      { key: "lectures", label: "nav.lectures", href: "/dashboard/lectures", icon: BookOpenCheck, capability: CAPABILITIES.lectures },
      { key: "files", label: "nav.files", href: "/dashboard/files", icon: FileStack, capability: CAPABILITIES.files },
      { key: "groups", label: "nav.groups", href: "/dashboard/groups", icon: Network, capability: CAPABILITIES.groups },
      { key: "announcements", label: "nav.announcements", href: "/dashboard/announcements", icon: Megaphone, capability: CAPABILITIES.announcements },
    ],
  },
  {
    key: "operations",
    label: "nav.operations",
    items: [
      { key: "printing", label: "nav.printing", href: "/dashboard/printing", icon: Printer, capability: CAPABILITIES.printing },
      { key: "support", label: "nav.support", href: "/dashboard/support", icon: Headphones, capability: CAPABILITIES.support },
      { key: "feedback", label: "nav.feedback", href: "/dashboard/feedback", icon: MessageSquareText, capability: CAPABILITIES.feedback },
      { key: "notifications", label: "nav.notifications", href: "/dashboard/notifications", icon: BellRing, capability: CAPABILITIES.announcements },
    ],
  },
  {
    key: "product",
    label: "nav.product",
    items: [
      { key: "releases", label: "nav.releases", href: "/dashboard/product/releases", icon: Smartphone, capability: CAPABILITIES.product },
      { key: "maintenance", label: "nav.maintenance", href: "/dashboard/product/maintenance", icon: Wrench, capability: CAPABILITIES.product },
      { key: "features", label: "nav.features", href: "/dashboard/product/features", icon: Flag, capability: CAPABILITIES.product },
      { key: "devices", label: "nav.devices", href: "/dashboard/product/devices", icon: MonitorSmartphone, capability: CAPABILITIES.product },
    ],
  },
  {
    key: "governance",
    label: "nav.governance",
    items: [
      { key: "policies", label: "nav.policies", href: "/dashboard/governance/policies", icon: ScrollText, capability: CAPABILITIES.product },
      { key: "deletions", label: "nav.deletions", href: "/dashboard/governance/deletions", icon: UserRoundCog, capability: CAPABILITIES.product },
      { key: "audit", label: "nav.audit", href: "/dashboard/audit", icon: FileCheck2, capability: CAPABILITIES.audit },
    ],
  },
  {
    key: "system",
    items: [
      { key: "health", label: "nav.systemHealth", href: "/dashboard/system/health", icon: Activity, capability: CAPABILITIES.dashboard },
      { key: "settings", label: "nav.settings", href: "/dashboard/settings", icon: Settings, capability: CAPABILITIES.dashboard },
    ],
  },
];

export const academicSubNavigation: NavigationItem[] = [
  { key: "universities", label: "nav.universities", href: "/dashboard/academic/universities", icon: University, capability: CAPABILITIES.academic },
  { key: "faculties", label: "nav.faculties", href: "/dashboard/academic/faculties", icon: Building2, capability: CAPABILITIES.academic },
  { key: "majors", label: "nav.majors", href: "/dashboard/academic/majors", icon: GraduationCap, capability: CAPABILITIES.academic },
  { key: "academicYears", label: "nav.academicYears", href: "/dashboard/academic/academic-years", icon: NotebookTabs, capability: CAPABILITIES.academic },
  { key: "semesters", label: "nav.semesters", href: "/dashboard/academic/semesters", icon: Tags, capability: CAPABILITIES.academic },
  { key: "subjects", label: "nav.subjects", href: "/dashboard/academic/subjects", icon: BookOpenCheck, capability: CAPABILITIES.academic },
];

export const allNavigationItems = [...navigationGroups.flatMap((group) => group.items), ...academicSubNavigation];

/** Maps a canonical (optionally locale-prefixed) dashboard URL to its UI gate. */
export function capabilityForDashboardPath(pathname: string): string | undefined {
  const withoutLocale = pathname.replace(/^\/(?:ar|en)(?=\/|$)/u, "");
  const normalized = withoutLocale.length > 1 ? withoutLocale.replace(/\/+$/u, "") : withoutLocale;
  const matchingItem = [...allNavigationItems]
    .sort((left, right) => right.href.length - left.href.length)
    .find((item) => normalized === item.href || normalized.startsWith(`${item.href}/`));
  return matchingItem?.capability;
}
