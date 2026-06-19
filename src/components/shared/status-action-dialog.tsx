"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { FormInput } from "@/components/forms/form-input";
import { FormSelect } from "@/components/forms/form-select";
import { FormTextarea } from "@/components/forms/form-textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";

const schema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  role: z.string().optional(),
  assigned_to: z.string().optional(),
  note: z.string().optional(),
  internal_notes: z.string().optional(),
  rejection_reason: z.string().optional(),
  admin_note: z.string().optional(),
  message: z.string().optional(),
});

export type StatusActionValues = z.infer<typeof schema>;

interface StatusActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  loading?: boolean;
  options?: { field: "status" | "priority" | "role"; label: string; items: { label: string; value: string }[] };
  fields?: Array<"assigned_to" | "note" | "internal_notes" | "rejection_reason" | "admin_note" | "message">;
  defaultValues?: StatusActionValues;
  onSubmit: (values: StatusActionValues) => Promise<void>;
}

export function StatusActionDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  loading,
  options,
  fields = ["note"],
  defaultValues,
  onSubmit,
}: StatusActionDialogProps) {
  const form = useForm<StatusActionValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {},
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues ?? {});
    }
  }, [defaultValues, form, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(async (values) => {
              await onSubmit(values);
              onOpenChange(false);
            })}
          >
            {options ? (
              <FormSelect control={form.control} name={options.field} label={options.label} options={options.items} />
            ) : null}
            {fields.includes("assigned_to") ? <FormInput control={form.control} name="assigned_to" label="Assigned user ID" /> : null}
            {fields.includes("rejection_reason") ? (
              <FormTextarea control={form.control} name="rejection_reason" label="Reason" />
            ) : null}
            {fields.includes("admin_note") ? <FormTextarea control={form.control} name="admin_note" label="Admin note" /> : null}
            {fields.includes("note") ? <FormTextarea control={form.control} name="note" label="Note" /> : null}
            {fields.includes("internal_notes") ? (
              <FormTextarea control={form.control} name="internal_notes" label="Internal notes" />
            ) : null}
            {fields.includes("message") ? <FormTextarea control={form.control} name="message" label="Message" /> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" isLoading={loading}>
                {submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
