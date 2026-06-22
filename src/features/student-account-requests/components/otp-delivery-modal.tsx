"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatArabicDate } from "@/features/student-account-requests/constants";
import type { StudentAccountRequestOtpPayload } from "@/features/student-account-requests/types";

interface OtpDeliveryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: StudentAccountRequestOtpPayload | null;
}

async function copyText(value: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
  } catch {
    toast.error("تعذر النسخ. حاول مرة أخرى.");
  }
}

export function OtpDeliveryModal({ open, onOpenChange, payload }: OtpDeliveryModalProps) {
  const otpCode = payload?.otp_code ?? "";
  const whatsappPhone = payload?.whatsapp_phone ?? "-";
  const manualMessage = payload?.manual_whatsapp_message ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>تم قبول الطالب وتوليد رمز التفعيل</DialogTitle>
          <DialogDescription>انسخ الرمز أو الرسالة وأرسلها يدوياً للطالب عبر واتساب.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
          <div className="text-center">
            <p className="mb-2 text-sm text-muted-foreground">رمز التفعيل</p>
            <p className="font-mono text-3xl font-bold tracking-widest text-primary">{otpCode || "-"}</p>
          </div>

          <div className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">رقم واتساب الطالب</span>
              <span className="font-medium" dir="ltr">{whatsappPhone}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">انتهاء صلاحية الرمز</span>
              <span className="font-medium">{formatArabicDate(payload?.otp_expires_at)}</span>
            </div>
          </div>

          {manualMessage ? (
            <div className="rounded-md border bg-background p-3 text-sm leading-relaxed">{manualMessage}</div>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            disabled={!otpCode}
            onClick={() => copyText(otpCode, "تم نسخ رمز التفعيل")}
          >
            <Copy />
            نسخ الرمز
          </Button>
          <Button
            type="button"
            disabled={!manualMessage}
            onClick={() => copyText(manualMessage, "تم نسخ رسالة واتساب")}
          >
            <Copy />
            نسخ رسالة واتساب
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}