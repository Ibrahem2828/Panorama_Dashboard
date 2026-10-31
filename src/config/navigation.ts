import { BarChart3,
  Activity,
  ArrowLeftRight,
  BookOpenCheck,
  Boxes,
  CalendarRange,
  Building2,
  ClipboardCheck,
  Inbox,
  MailCheck,
  ShoppingCart,
  Store,
  ListChecks,
  FileCheck2,
  FileStack,
  Flag,
  GraduationCap,
  History,
  Headphones,
  LayoutDashboard,
  Megaphone,
  MessageSquareText,
  MessageSquareWarning,
  MonitorSmartphone,
  Network,
  NotebookTabs,
  Printer,
  RadioTower,
  Receipt,
  ReceiptText,
  ScrollText,
  Settings,
  ShieldCheck,
  Smartphone,
  Tags,
  University,
  UserRoundCog,
  UserRound,
  UserSearch,
  UserPlus,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { CAPABILITIES, hasCapability } from "@/lib/auth/capabilities";
import type { MessageKey } from "@/i18n/messages";

export interface NavigationItem {
  key: string;
  label: MessageKey;
  href: string;
  icon: LucideIcon;
  capability?: string;
  /** Pages several capabilities open (any one is enough): `capability` stays empty so the shell does not demand a single one; the page gates on the same list. */
  anyCapability?: string[];
  keywords?: string[];
  /** Small badge shown next to the label (for screens that are not live yet). */
  badge?: MessageKey;
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
      { key: "inbox", label: "nav.inbox", href: "/dashboard/inbox", icon: Inbox, capability: CAPABILITIES.dashboard, keywords: ["إشعارات", "inbox", "notifications"] },
    ],
  },
  {
    key: "administration",
    label: "nav.administration",
    items: [
      { key: "students", label: "nav.students", href: "/dashboard/students", icon: UserSearch, anyCapability: [CAPABILITIES.users, CAPABILITIES.verification], keywords: ["طلاب", "طالب", "توثيق", "students", "verified"] },
      { key: "users", label: "nav.users", href: "/dashboard/users", icon: Users, capability: CAPABILITIES.users },
      { key: "rbac", label: "nav.rbac", href: "/dashboard/rbac", icon: ShieldCheck, capability: CAPABILITIES.users },
      { key: "academic", label: "nav.academic", href: "/dashboard/academic", icon: GraduationCap, capability: CAPABILITIES.academic },
      { key: "enrollment", label: "nav.enrollment", href: "/dashboard/enrollment", icon: ListChecks, capability: CAPABILITIES.enrollment },
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
      { key: "groupJoinRequests", label: "nav.groupJoinRequests", href: "/dashboard/groups/requests", icon: UserPlus, capability: CAPABILITIES.groups, keywords: ["انضمام", "طلبات المجموعات", "join requests", "group requests"] },
      { key: "announcements", label: "nav.announcements", href: "/dashboard/announcements", icon: Megaphone, capability: CAPABILITIES.announcements },
      { key: "chatConsole", label: "nav.chatConsole", href: "/dashboard/chat-console", icon: MessageSquareText, capability: CAPABILITIES.groups },
      { key: "chatReports", label: "nav.chatReports", href: "/dashboard/chat-reports", icon: MessageSquareWarning, capability: CAPABILITIES.groups },
    ],
  },
  {
    key: "operations",
    label: "nav.operations",
    items: [
      { key: "printing", label: "nav.printing", href: "/dashboard/printing", icon: Printer, capability: CAPABILITIES.printing },
      { key: "shop", label: "nav.shop", href: "/dashboard/shop", icon: Store, capability: CAPABILITIES.printing },
      { key: "support", label: "nav.support", href: "/dashboard/support", icon: Headphones, capability: CAPABILITIES.support },
      { key: "feedback", label: "nav.feedback", href: "/dashboard/feedback", icon: MessageSquareText, capability: CAPABILITIES.feedback },
      { key: "notifications", label: "nav.notifications", href: "/dashboard/notifications", icon: RadioTower, capability: CAPABILITIES.product },
    ],
  },
  {
    key: "finance",
    label: "nav.finance",
    items: [
      { key: "financeOverview", label: "nav.financeOverview", href: "/dashboard/finance", icon: Wallet, capability: CAPABILITIES.finance },
      { key: "financeJobs", label: "nav.financeJobs", href: "/dashboard/finance/jobs", icon: ReceiptText, capability: CAPABILITIES.printing },
      { key: "financeStock", label: "nav.financeStock", href: "/dashboard/finance/stock", icon: Boxes, capability: CAPABILITIES.printing },
      { key: "financeStockReport", label: "nav.financeStockReport", href: "/dashboard/finance/stock-report", icon: BarChart3, capability: CAPABILITIES.finance },
      { key: "financePurchases", label: "nav.financePurchases", href: "/dashboard/finance/purchases", icon: ShoppingCart, capability: CAPABILITIES.finance },
      { key: "financeExpenses", label: "nav.financeExpenses", href: "/dashboard/finance/expenses", icon: Receipt, capability: CAPABILITIES.finance },
      { key: "financeRates", label: "nav.financeRates", href: "/dashboard/finance/rates", icon: ArrowLeftRight, capability: CAPABILITIES.finance },
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
      { key: "deletions", label: "nav.deletions", href: "/dashboard/governance/deletions", icon: UserRoundCog, capability: CAPABILITIES.users },
      { key: "audit", label: "nav.audit", href: "/dashboard/audit", icon: FileCheck2, capability: CAPABILITIES.audit },
      { key: "systemActivity", label: "nav.systemActivity", href: "/dashboard/system/activity", icon: History, capability: CAPABILITIES.audit, keywords: ["سجل النظام", "نشاط", "تسجيل الدخول", "system activity", "login", "requests"] },
    ],
  },
  {
    key: "system",
    items: [
      { key: "notificationHealth", label: "nav.notificationHealth", href: "/dashboard/system/notification-health", icon: MailCheck, capability: CAPABILITIES.system },
      { key: "health", label: "nav.systemHealth", href: "/dashboard/system/health", icon: Activity, capability: CAPABILITIES.dashboard },
    ],
  },
];

/**
 * Personal pages. They live in the user menu (topbar) and nowhere else: settings and the profile are not sidebar
 * entries, so each purpose has exactly one door. They stay registered here so route gating and the command palette know them.
 */
export const accountNavigation: NavigationItem[] = [
  { key: "profile", label: "nav.profile", href: "/dashboard/profile", icon: UserRound, capability: CAPABILITIES.dashboard, keywords: ["ملفي", "الاسم", "المسمى", "كلمة المرور", "profile", "password"] },
  { key: "settings", label: "nav.settings", href: "/dashboard/settings", icon: Settings, capability: CAPABILITIES.dashboard, keywords: ["مظهر", "لغة", "settings", "theme"] },
];

export const academicSubNavigation: NavigationItem[] = [
  { key: "universities", label: "nav.universities", href: "/dashboard/academic/universities", icon: University, capability: CAPABILITIES.academic },
  { key: "faculties", label: "nav.faculties", href: "/dashboard/academic/faculties", icon: Building2, capability: CAPABILITIES.academic },
  { key: "majors", label: "nav.majors", href: "/dashboard/academic/majors", icon: GraduationCap, capability: CAPABILITIES.academic },
  { key: "academicYears", label: "nav.academicYears", href: "/dashboard/academic/academic-years", icon: NotebookTabs, capability: CAPABILITIES.academic },
  { key: "semesters", label: "nav.semesters", href: "/dashboard/academic/semesters", icon: Tags, capability: CAPABILITIES.academic },
  { key: "term", label: "nav.term", href: "/dashboard/academic/term", icon: CalendarRange, capability: CAPABILITIES.academic, keywords: ["إنهاء الفصل", "الفصل الحالي", "term", "semester"] },
  { key: "subjects", label: "nav.subjects", href: "/dashboard/academic/subjects", icon: BookOpenCheck, capability: CAPABILITIES.academic },
];

export const allNavigationItems = [...navigationGroups.flatMap((group) => group.items), ...accountNavigation, ...academicSubNavigation];

/** Whether the signed-in capabilities open a navigation item (a single `capability` or any of `anyCapability`). */
export function navigationItemAllowed(item: Pick<NavigationItem, "capability" | "anyCapability">, capabilities: readonly string[] | undefined): boolean {
  if (item.anyCapability?.length) return item.anyCapability.some((capability) => hasCapability(capabilities, capability));
  return hasCapability(capabilities, item.capability);
}

/**
 * The sidebar entry that owns a path: the longest matching href among the sidebar items, so `/dashboard/groups/requests`
 * lights up its own entry and not "Groups" as well.
 */
export function activeNavigationHref(pathname: string): string | undefined {
  const withoutLocale = pathname.replace(/^\/(?:ar|en)(?=\/|$)/u, "");
  const normalized = withoutLocale.length > 1 ? withoutLocale.replace(/\/+$/u, "") : withoutLocale;
  return navigationGroups.flatMap((group) => group.items).map((item) => item.href).sort((left, right) => right.length - left.length)
    .find((href) => normalized === href || (href !== "/dashboard" && normalized.startsWith(`${href}/`)));
}

/** Maps a canonical (optionally locale-prefixed) dashboard URL to its UI gate. */
export function capabilityForDashboardPath(pathname: string): string | undefined {
  const withoutLocale = pathname.replace(/^\/(?:ar|en)(?=\/|$)/u, "");
  const normalized = withoutLocale.length > 1 ? withoutLocale.replace(/\/+$/u, "") : withoutLocale;
  const matchingItem = [...allNavigationItems]
    .sort((left, right) => right.href.length - left.href.length)
    // The overview ("/dashboard") only matches itself; otherwise it would claim every unknown sub-route.
    .find((item) => normalized === item.href || (item.href !== "/dashboard" && normalized.startsWith(`${item.href}/`)));
  return matchingItem?.capability;
}
