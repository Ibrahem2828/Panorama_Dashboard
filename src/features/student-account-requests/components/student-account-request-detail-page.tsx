"use client";

import { ArrowRight, Check, FileImage, RefreshCcw, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ErrorState } from "@/components/feedback/error-state";
import { PageLoader } from "@/components/feedback/page-loader";
import { AccessDenied } from "@/components/shared/access-denied";
import { FieldGrid, FieldItem } from "@/components/shared/field-grid";
import { PageHeader } from "@/components/shared/page-header";
import { ProtectedMediaButton } from "@/components/shared/protected-media-button";
import { NeedsUpdateDialog } from "@/features/student-account-requests/components/needs-update-dialog";
import { OtpDeliveryModal } from "@/features/student-account-requests/components/otp-delivery-modal";
import { RejectRequestDialog } from "@/features/student-account-requests/components/reject-request-dialog";
import { StudentAccountRequestStatusBadge } from "@/features/student-account-requests/components/student-account-request-status-badge";
import { createCardPreviewToken } from "@/features/student-account-requests/api";
import {
  formatArabicDate,
  getArabicErrorMessage,
} from "@/features/student-account-requests/constants";
import { useStudentAccountRequest, useStudentAccountRequestAction } from "@/features/student-account-requests/hooks";
import type { StudentAccountRequestOtpPayload } from "@/features/student-account-requests/types";

function isOtpPayload(data: unknown): data is StudentAccountRequestOtpPayload {
  return Boolean(data && typeof data === "object" && "otp_code" in data && (data as StudentAccountRequestOtpPayload).otp_code);
}

function showOtpModal(
  result: unknown,
  setOtpPayload: (payload: StudentAccountRequestOtpPayload | null) => void,
  setOtpModalOpen: (open: boolean) => void,
) {
  if (isOtpPayload(result)) {
    setOtpPayload(result);
    setOtpModalOpen(true);
  }
}
import { getRelatedName } from "@/features/academic/components/helpers";
import { useCurrentUser } from "@/hooks/use-current-user";
import { readString } from "@/lib/object";
import { canManageStudentAccountRequests } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface StudentAccountRequestDetailPageProps {
  requestId: string;
}

function getPhoneNumber(record: { phone_number?: string; whatsapp_phone?: string }) {
  return readString(record, ["phone_number", "whatsapp_phone"]) || "-";
}

export function StudentAccountRequestDetailPage({ requestId }: StudentAccountRequestDetailPageProps) {
  const user = useCurrentUser();
  const detailQuery = useStudentAccountRequest(requestId);
  const actionMutation = useStudentAccountRequestAction();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [needsUpdateOpen, setNeedsUpdateOpen] = useState(false);
  const [otpPayload, setOtpPayload] = useState<StudentAccountRequestOtpPayload | null>(null);
  const [otpModalOpen, setOtpModalOpen] = useState(false);

  if (!canManageStudentAccountRequests(user?.role)) {
    return (
      <AccessDenied
        title="الوصول مقيّد"
        description="لا تملك صلاحية لعرض طلبات حسابات الطلاب."
      />
    );
  }

  if (detailQuery.isLoading) {
    return <PageLoader label="جاري تحميل تفاصيل الطلب" />;
  }

  if (detailQuery.error || !detailQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="تفاصيل الطلب" />
        <ErrorState
          message={getArabicErrorMessage(detailQuery.error)}
          onRetry={() => detailQuery.refetch()}
        />
      </div>
    );
  }

  const detail = detailQuery.data;
  const status = detail.status;
  const canReview = status === "pending_review";
  const canResendOtp = status === "approved_pending_otp" || status === "otp_sent";
  const canApproveFromNeedsUpdate = status === "needs_update";

  async function handleApprove() {
    try {
      const result = await actionMutation.mutateAsync({ id: detail.id, action: "approve" });
      showOtpModal(result, setOtpPayload, setOtpModalOpen);
    } catch {
      // Errors are surfaced via mutation onError toast.
    }
  }

  async function handleResendOtp() {
    try {
      const result = await actionMutation.mutateAsync({ id: detail.id, action: "resend_otp" });
      showOtpModal(result, setOtpPayload, setOtpModalOpen);
    } catch {
      // Errors are surfaced via mutation onError toast.
    }
  }

  function handleOtpModalChange(open: boolean) {
    setOtpModalOpen(open);
    if (!open) {
      setOtpPayload(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={readString(detail, ["full_name"]) || "تفاصيل الطلب"}
        description={`تاريخ الطلب: ${formatArabicDate(detail.created_at)}`}
        breadcrumbs={[
          { label: "طلبات حسابات الطلاب", href: ROUTES.studentAccountRequests },
          { label: readString(detail, ["full_name"]) || `طلب #${detail.id}` },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href={ROUTES.studentAccountRequests}>
            <ArrowRight />
            العودة للقائمة
          </Link>
        </Button>
        <StudentAccountRequestStatusBadge status={status} />
      </div>

      <FieldGrid title="معلومات الطالب">
        <FieldItem label="الاسم الكامل" value={readString(detail, ["full_name"]) || "-"} />
        <FieldItem label="البريد الإلكتروني" value={readString(detail, ["email"]) || "-"} />
        <FieldItem label="رقم الجوال / واتساب" value={<span dir="ltr">{getPhoneNumber(detail)}</span>} />
        <FieldItem label="الرقم الجامعي" value={readString(detail, ["student_number"]) || "-"} />
        <FieldItem label="الجامعة" value={getRelatedName(detail.university_detail ?? detail.university)} />
        <FieldItem label="الكلية" value={getRelatedName(detail.faculty_detail ?? detail.faculty)} />
        <FieldItem label="التخصص" value={getRelatedName(detail.major_detail ?? detail.major)} />
        <FieldItem label="سنة الدراسة" value={getRelatedName(detail.academic_year_detail ?? detail.academic_year)} />
      </FieldGrid>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">البطاقة الجامعية</CardTitle>
          <CardDescription>معاينة آمنة للبطاقة المرفوعة دون عرض مسار الملف مباشرة.</CardDescription>
        </CardHeader>
        <CardContent>
          {detail.has_uploaded_card ? (
            <ProtectedMediaButton
              getPreviewToken={() => createCardPreviewToken(detail.id)}
              formatError={getArabicErrorMessage}
              label="معاينة البطاقة"
            >
              <FileImage />
              معاينة البطاقة
            </ProtectedMediaButton>
          ) : (
            <p className="text-sm text-muted-foreground">لم يتم رفع بطاقة جامعية مع هذا الطلب.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">قرار المراجعة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canReview ? (
            <div className="flex flex-wrap gap-2">
              <ConfirmDialog
                trigger={<Button size="sm" disabled={actionMutation.isPending}><Check />قبول الطالب</Button>}
                title="قبول طلب الطالب"
                description="بعد قبول الطلب سيتم توليد رمز تفعيل للطالب. انسخ الرمز وأرسله يدوياً إلى الطالب عبر واتساب."
                confirmLabel="قبول وتوليد الرمز"
                cancelLabel="إلغاء"
                onConfirm={() => {
                  void handleApprove();
                }}
              />
              <Button size="sm" variant="destructive" disabled={actionMutation.isPending} onClick={() => setRejectOpen(true)}>
                <X />
                رفض الطلب
              </Button>
              <Button size="sm" variant="outline" disabled={actionMutation.isPending} onClick={() => setNeedsUpdateOpen(true)}>
                <RefreshCcw />
                طلب تعديل البيانات
              </Button>
            </div>
          ) : null}

          {canApproveFromNeedsUpdate ? (
            <div className="space-y-3">
              {detail.needs_update_reason ? (
                <p className="rounded-md border bg-muted/30 p-3 text-sm">
                  <span className="font-medium">سبب طلب التعديل: </span>
                  {detail.needs_update_reason}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <ConfirmDialog
                  trigger={<Button size="sm" disabled={actionMutation.isPending}><Check />قبول الطالب</Button>}
                  title="قبول طلب الطالب"
                  description="بعد قبول الطلب سيتم توليد رمز تفعيل للطالب. انسخ الرمز وأرسله يدوياً إلى الطالب عبر واتساب."
                  confirmLabel="قبول وتوليد الرمز"
                  cancelLabel="إلغاء"
                  onConfirm={() => {
                    void handleApprove();
                  }}
                />
              </div>
            </div>
          ) : null}

          {canResendOtp ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                تم توليد رمز التفعيل وينتظر إدخال الطالب. يمكنك إعادة توليد الرمز عند الحاجة.
              </p>
              <ConfirmDialog
                trigger={<Button size="sm" variant="outline" disabled={actionMutation.isPending}>إعادة توليد رمز التفعيل</Button>}
                title="إعادة توليد رمز التفعيل"
                description="سيتم إلغاء الرمز السابق وتوليد رمز جديد. هل تريد المتابعة؟"
                confirmLabel="متابعة"
                cancelLabel="إلغاء"
                onConfirm={() => {
                  void handleResendOtp();
                }}
              />
            </div>
          ) : null}

          {status === "active" ? (
            <p className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
              تم تفعيل حساب الطالب بنجاح.
            </p>
          ) : null}

          {status === "rejected" ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="font-medium">سبب الرفض</p>
              <p className="mt-1">{detail.rejection_reason || "-"}</p>
            </div>
          ) : null}

          {status === "expired" ? (
            <p className="text-sm text-muted-foreground">انتهت صلاحية هذا الطلب.</p>
          ) : null}

          {!canReview && !canApproveFromNeedsUpdate && !canResendOtp && status !== "active" && status !== "rejected" && status !== "expired" ? (
            <p className="text-sm text-muted-foreground">لا تتوفر إجراءات إضافية لهذه الحالة حالياً.</p>
          ) : null}
        </CardContent>
      </Card>

      <FieldGrid title="معلومات المراجعة">
        <FieldItem label="تمت المراجعة بواسطة" value={detail.reviewed_by_name || "-"} />
        <FieldItem label="تاريخ المراجعة" value={formatArabicDate(detail.reviewed_at)} />
        <FieldItem label="تاريخ القبول" value={formatArabicDate(detail.approved_at)} />
        <FieldItem label="تاريخ التفعيل" value={formatArabicDate(detail.activated_at)} />
        {detail.admin_note ? <FieldItem label="ملاحظة إدارية" value={detail.admin_note} /> : null}
      </FieldGrid>

      <RejectRequestDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        loading={actionMutation.isPending}
        onSubmit={async (values) => {
          await actionMutation.mutateAsync({
            id: detail.id,
            action: "reject",
            payload: { rejection_reason: values.rejection_reason },
          });
        }}
      />

      <NeedsUpdateDialog
        open={needsUpdateOpen}
        onOpenChange={setNeedsUpdateOpen}
        loading={actionMutation.isPending}
        onSubmit={async (values) => {
          await actionMutation.mutateAsync({
            id: detail.id,
            action: "needs_update",
            payload: { needs_update_reason: values.needs_update_reason },
          });
        }}
      />

      <OtpDeliveryModal open={otpModalOpen} onOpenChange={handleOtpModalChange} payload={otpPayload} />
    </div>
  );
}