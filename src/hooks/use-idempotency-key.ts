"use client";

import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";

import { useI18n } from "@/i18n/provider";
import { apiErrorText } from "@/lib/api/error-message";
import { idempotencyConflict } from "@/lib/api/errors";
import { createIdempotencyKeyStore, type IdempotencyKeyStore } from "@/lib/api/idempotency";

/**
 * Stable idempotency key per form. `get(signature)` returns the same key for retries of the same payload and a new one
 * once the payload changes; `reset()` after success.
 */
export function useIdempotencyKey(): IdempotencyKeyStore {
  const ref = useRef<IdempotencyKeyStore | null>(null);
  return useMemo(() => (ref.current ??= createIdempotencyKeyStore()), []);
}

/**
 * `onError` for a mutation that uses `store`: shows the (localized for idempotency conflicts) message and, when the
 * backend says the key belongs to a different payload, drops the key so the next attempt starts a fresh logical submit.
 */
export function useMutationError(store?: IdempotencyKeyStore) {
  const { t } = useI18n();
  return useCallback((error: unknown) => {
    if (idempotencyConflict(error) === "reused") store?.reset();
    toast.error(apiErrorText(error, t));
  }, [store, t]);
}
