import { Boxes, ClipboardCheck, Headphones, Inbox, ListChecks, MessageSquareWarning, Printer, ShoppingCart, Store, UserPlus, UploadCloud, Wallet } from "lucide-react";
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
  { key: "inbox", label: "quick.inbox", hint: "quick.inboxHint", icon: Inbox, href: "/dashboard/inbox", capability: CAPABILITIES.dashboard, count: "notifications_unread", keywords: ["إشعارات", "صندوق", "inbox"] },
];

/** One-step creators: they land on the page with its form already open. */
export const CREATE_ACTIONS: QuickAction[] = [
  { key: "addUser", label: "quick.addUser", hint: "quick.addUserHint", icon: UserPlus, href: "/dashboard/users?new=1", capability: CAPABILITIES.users, keywords: ["مستخدم", "موظف", "دعوة", "user", "invite"] },
  { key: "newPurchase", label: "quick.newPurchase", hint: "quick.newPurchaseHint", icon: ShoppingCart, href: "/dashboard/finance/purchases?new=1", capability: CAPABILITIES.finance, keywords: ["مشتريات", "شراء", "purchase"] },
  { key: "sellStationery", label: "quick.sellStationery", hint: "quick.sellStationeryHint", icon: Store, href: "/dashboard/shop", capability: CAPABILITIES.printing, keywords: ["قرطاسية", "بيع", "shop", "sell"] },
  { key: "uploadFiles", label: "quick.uploadFiles", hint: "quick.uploadFilesHint", icon: UploadCloud, href: "/dashboard/files", capability: CAPABILITIES.files, keywords: ["رفع", "ملفات", "upload"] },
];

export const QUICK_ACTIONS: QuickAction[] = [...ATTENTION_ACTIONS, ...CREATE_ACTIONS];
