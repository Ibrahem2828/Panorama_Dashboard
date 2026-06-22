"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { FormTextarea } from "@/components/forms/form-textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";

const schema = z.object({
  rejection_reason: z.string().trim().min(5, "يرجى إدخال سبب واضح."),
});

type FormValues = z.infer<typeof schema>;

interface RejectRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  onSubmit: (values: FormValues) => Promise<void>;
}

export function RejectRequestDialog({ open, onOpenChange, loading, onSubmit }: RejectRequestDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { rejection_reason: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({ rejection_reason: "" });
    }
  }, [form, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>رفض الطلب</DialogTitle>
          <DialogDescription>أدخل سبب الرفض بوضوح. سيتم إبلاغ الطالب بالسبب.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(async (values) => {
              await onSubmit(values);
              onOpenChange(false);
            })}
          >
            <FormTextarea control={form.control} name="rejection_reason" label="سبب الرفض" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                إلغاء
              </Button>
              <Button type="submit" variant="destructive" isLoading={loading}>
                رفض الطلب
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}