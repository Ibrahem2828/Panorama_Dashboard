"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, type DefaultValues, type FieldValues, type Resolver, type SubmitHandler, type UseFormReturn } from "react-hook-form";
import type { ZodType } from "zod";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { applyBackendFieldErrors } from "@/lib/api/field-errors";

interface EntityDialogProps<TValues extends FieldValues> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  schema: ZodType<unknown>;
  defaultValues: DefaultValues<TValues>;
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit: (values: TValues) => Promise<void>;
  children: (form: UseFormReturn<TValues>) => React.ReactNode;
}

export function EntityDialog<TValues extends FieldValues>({
  open,
  onOpenChange,
  title,
  description,
  schema,
  defaultValues,
  submitLabel,
  isSubmitting,
  onSubmit,
  children,
}: EntityDialogProps<TValues>) {
  const form = useForm<TValues>({
    resolver: zodResolver(schema as never) as Resolver<TValues>,
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
    }
  }, [defaultValues, form, open]);

  const handleSubmit: SubmitHandler<TValues> = async (values) => {
    try {
      await onSubmit(values);
      form.reset(defaultValues);
      onOpenChange(false);
    } catch (error) {
      applyBackendFieldErrors(form, error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-5" onSubmit={form.handleSubmit(handleSubmit)}>
            {children(form)}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                {submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
