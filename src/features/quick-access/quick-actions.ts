import { Boxes, CalendarRange, ClipboardCheck, Headphones, ListChecks, MessageSquareWarning, Printer, ShoppingCart, Store, UserCheck, UserPlus, UploadCloud, Users, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { MessageKey } from "@/i18n/messages";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import type { QuickAccessCounts } from "@/features/notifications/inbox";

export interface QuickAction {
  key: string;
  label: MessageKey;
  hint: MessageKey;
  icon: LucideIcon;
  href: string;
  capability?: string;
  /** Live number shown as a badge (a pending queue). Actions without one are plain shortcuts. */
  count?: keyof QuickAccessCounts;
  /** The tile exists only when the backend sends this counter (it omits it for people who may not act on it). */
  onlyWhenCounted?: boolean;
  /** Extra words the palette matches (Arabic and English). */
  keywords?: string[];
}

/** Things waiting for a person: each one carries a live counter and opens the page where the work is done. */
export const ATTENTION_ACTIONS: QuickAction[] = [
  { key: "enrollment", label: "quick.enrollment", hint: "quick.enrollmentHint", icon: ListChecks, href: "/dashboard/enrollment", capability: CAPABILITIES.enrollment, count: "enrollment_pending", keywords: ["تسجيل", "مواد", "enrollment"] },
  { key: "verifications", label: "quick.verifications", hint: "quick.verificationsHint", icon: ClipboardCheck, href: "/dashboard/verifications", capability: CAPABILITIES.verification, count: "verification_pending", keywords: ["توثيق", "بطاقة", "verification"] },
  { key: "chatReports", label: "quick.chatReports", hint: "quick.chatReportsHint", icon: MessageSquareWarning, href: "/dashboard/chat-reports", capability: CAPABILITIES.groups, count: "chat_reports_open", keywords: ["بلاغ", "دردشة", "report"] },
  { key: "printOrders", label: "quick.printOrders", hint: "quick.printOrdersHint", icon: Printer, href: "/dashboard/printing", capability: CAPABILITIES.printing, count: "print_orders_new", keywords: ["طباعة", "طلب", "print"] },
  { key: "support", label: "quick.support", hint: "quick.supportHint", icon: Headphones, href: "/dashboard/support", capability: CAPABILITIES.support, count: "support_open", keywords: ["دعم", "تذكرة", "support"] },
  { key: "lowStock", label: "quick.lowStock", hint: "quick.lowStockHint", icon: Boxes, href: "/dashboard/finance/stock", capability: CAPABILITIES.printing, count: "low_stock", keywords: ["مخزون", "نفاد", "stock"] },
  { key: "reminders", label: "quick.reminders", hint: "quick.remindersHint", icon: Wallet, href: "/dashboard/finance/purchases", capability: CAPABILITIES.finance, count: "purchase_reminders_due", keywords: ["تذكير", "شراء", "حبر", "reminder"] },
  { key: "joinRequests", label: "quick.joinRequests", hint: "quick.joinRequestsHint", icon: Users, href: "/dashboard/groups", capability: CAPABILITIES.groups, count: "join_requests_pending", onlyWhenCounted: true, keywords: ["انضمام", "مجموعة", "join"] },
  { key: "registrations", label: "quick.registrations", hint: "quick.registrationsHint", icon: UserCheck, href: "/dashboard/verifications", capability: CAPABILITIES.verification, count: "registrations_new", onlyWhenCounted: true, keywords: ["تسجيل جديد", "طالب جديد", "registration"] },
  // The inbox has no tile: it is reached from the bell and the sidebar, never from a second place.
];

/** Shown only when the current term has been running long enough that the admin probably needs to end it. */
export const TERM_ACTION: QuickAction = { key: "term", label: "quick.term", hint: "quick.termHint", icon: CalendarRange, href: "/dashboard/academic/term", capability: CAPABILITIES.academic, keywords: ["الفصل", "إنهاء", "term"] };

/** Days a term runs before the panel nudges the admin about ending it (a semester is about 4 months). */
export const TERM_ATTENTION_DAYS = 120;

export function termNeedsAttention(termStartedAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!termStartedAt) return false;
  const started = Date.parse(termStartedAt);
  if (Number.isNaN(started)) return false;
  return (now - started) / 86_400_000 >= TERM_ATTENTION_DAYS;
}

/** Counted tiles marked `onlyWhenCounted` are hidden until their counter exists in the response. */
export function visibleAttention(actions: readonly QuickAction[], counts: QuickAccessCounts | undefined): QuickAction[] {
  return actions.filter((action) => !action.onlyWhenCounted || (action.count !== undefined && counts !== undefined && counts[action.count] !== undefined));
}

/** One-step creators: they land on the page with its form already open. */
export const CREATE_ACTIONS: QuickAction[] = [
  { key: "addUser", label: "quick.addUser", hint: "quick.addUserHint", icon: UserPlus, href: "/dashboard/users?new=1", capability: CAPABILITIES.users, keywords: ["مستخدم", "موظف", "دعوة", "user", "invite"] },
  { key: "newPurchase", label: "quick.newPurchase", hint: "quick.newPurchaseHint", icon: ShoppingCart, href: "/dashboard/finance/purchases?new=1", capability: CAPABILITIES.finance, keywords: ["مشتريات", "شراء", "purchase"] },
  { key: "sellStationery", label: "quick.sellStationery", hint: "quick.sellStationeryHint", icon: Store, href: "/dashboard/shop", capability: CAPABILITIES.printing, keywords: ["قرطاسية", "بيع", "shop", "sell"] },
  { key: "uploadFiles", label: "quick.uploadFiles", hint: "quick.uploadFilesHint", icon: UploadCloud, href: "/dashboard/files", capability: CAPABILITIES.files, keywords: ["رفع", "ملفات", "upload"] },
];

export const QUICK_ACTIONS: QuickAction[] = [...ATTENTION_ACTIONS, ...CREATE_ACTIONS];
