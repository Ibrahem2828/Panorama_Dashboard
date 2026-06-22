import { normalizeApiError } from "@/lib/api/errors";

import type { StudentAccountRequestStatus } from "@/features/student-account-requests/types";

export const STUDENT_ACCOUNT_REQUEST_STATUS_LABELS: Record<StudentAccountRequestStatus, string> = {
  pending_review: "قيد المراجعة",
  approved_pending_otp: "بانتظار إرسال رمز التفعيل",
  otp_sent: "تم توليد رمز التفعيل",
  active: "مفعّل",
  rejected: "مرفوض",
  needs_update: "يحتاج تعديل",
  expired: "منتهي",
};

export const STATUS_FILTER_TABS: Array<{ value: string; label: string }> = [
  { value: "all", label: "الكل" },
  { value: "pending_review", label: "قيد المراجعة" },
  { value: "approved_pending_otp", label: "بانتظار رمز التفعيل" },
  { value: "otp_sent", label: "تم توليد رمز التفعيل" },
  { value: "active", label: "مفعّل" },
  { value: "needs_update", label: "يحتاج تعديل" },
  { value: "rejected", label: "مرفوض" },
  { value: "expired", label: "منتهي" },
];

export function getStatusLabel(status?: string | null) {
  if (!status) {
    return "-";
  }
  return STUDENT_ACCOUNT_REQUEST_STATUS_LABELS[status as StudentAccountRequestStatus] ?? status;
}

export function getArabicErrorMessage(error: unknown) {
  const normalized = normalizeApiError(error);
  const message = normalized.message.toLowerCase();

  if (normalized.status === 403) {
    return "لا تملك صلاحية لتنفيذ هذا الإجراء.";
  }

  if (normalized.status === 404) {
    return "لم يتم العثور على الطلب.";
  }

  if (normalized.status === 400 && (message.includes("wait") || message.includes("cooldown") || message.includes("resend"))) {
    return "لا يمكن إعادة توليد الرمز الآن. حاول مرة أخرى بعد قليل.";
  }

  if (normalized.status === 400) {
    return "يرجى إدخال سبب واضح.";
  }

  if (message.includes("network") || message.includes("reach") || message.includes("connection")) {
    return "تعذر الاتصال بالخادم. تحقق من الاتصال وحاول مرة أخرى.";
  }

  return "حدث خطأ غير متوقع. حاول مرة أخرى.";
}

export function formatArabicDate(value?: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ar", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}