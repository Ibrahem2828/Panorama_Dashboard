import type { UseFormReturn, FieldValues, Path } from "react-hook-form";

import { normalizeApiError } from "@/lib/api/errors";

export function applyBackendFieldErrors<TValues extends FieldValues>(form: UseFormReturn<TValues>, error: unknown) {
  const normalized = normalizeApiError(error);

  if (!normalized.errors) {
    return;
  }

  Object.entries(normalized.errors).forEach(([field, messages]) => {
    const msg = Array.isArray(messages) ? messages.join(" ") : (messages || "");
    form.setError(field as Path<TValues>, {
      type: "server",
      message: msg,
    });
  });
}
