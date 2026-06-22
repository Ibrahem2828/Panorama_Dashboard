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
  needs_update_reason: z.string().trim().min(5, "يرجى إدخال سبب واضح."),
});

type FormValues = z.infer<typeof schema>;

interface NeedsUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  onSubmit: (values: FormValues) => Promise<void>;
}

export function NeedsUpdateDialog({ open, onOpenChange, loading, onSubmit }: NeedsUpdateDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { needs_update_reason: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({ needs_update_reason: "" });
    }
  }, [form, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>طلب تعديل البيانات</DialogTitle>
          <DialogDescription>اكتب البيانات التي يجب على الطالب تعديلها أو إعادة رفعها.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(async (values) => {
              await onSubmit(values);
              onOpenChange(false);
            })}
          >
            <FormTextarea control={form.control} name="needs_update_reason" label="الملاحظات المطلوبة من الطالب" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                إلغاء
              </Button>
              <Button type="submit" isLoading={loading}>
                إرسال الطلب
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}