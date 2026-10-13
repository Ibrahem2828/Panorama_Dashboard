"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2Off } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ResourceFormDialog, type FormBody } from "@/components/forms/resource-form-dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { FieldSpec } from "@/features/resources/form-schema";
import { whatsappUrlRule } from "@/features/groups/group-rules";
import { useCan } from "@/features/session";
import { useIdempotencyKey, useMutationError } from "@/hooks/use-idempotency-key";
import { useI18n } from "@/i18n/provider";
import { apiFetch } from "@/lib/api/browser-client";
import { payloadSignature } from "@/lib/api/idempotency";
import { CAPABILITIES } from "@/lib/auth/capabilities";

const specs: FieldSpec[] = [
  { name: "url", kind: "url", required: true, nullable: false, maxLength: 2048, label: "groups.whatsapp.url", hint: "groups.whatsapp.urlHint" },
  { name: "label", kind: "text", required: false, nullable: false, maxLength: 100, label: "groups.whatsapp.label" },
  { name: "is_active", kind: "boolean", required: false, nullable: false, defaultValue: true, label: "groups.whatsapp.enabled" },
];

/**
 * WhatsApp channel of a group (capability `groups.external_channels.manage`). The backend never returns the stored link,
 * so the form always starts empty; saving replaces it, and "disable" deactivates the channel without exposing anything.
 */
export function GroupWhatsappDialog({ group, onOpenChange }: { group: { id: number; name: string; has_whatsapp_channel?: boolean } | null; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const allowed = useCan(CAPABILITIES.externalChannels);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const saveKey = useIdempotencyKey();
  const saveError = useMutationError(saveKey);
  const disableKey = useIdempotencyKey();
  const disableError = useMutationError(disableKey);
  const crossRules = useMemo(() => [whatsappUrlRule], []);

  const finish = () => {
    toast.success(t("common.success"));
    onOpenChange(false);
    setConfirmDisable(false);
    void queryClient.invalidateQueries({ queryKey: ["resource", "groups"] });
  };

  const save = useMutation({
    mutationFn: (body: FormBody) => apiFetch(`/api/v1/dashboard/groups/${group?.id}/whatsapp-channel/`, { method: "PUT", body, idempotencyKey: saveKey.get(payloadSignature("whatsapp", group?.id, body)) }),
    onSuccess() { saveKey.reset(); finish(); },
    onError: saveError,
  });
  const disable = useMutation({
    mutationFn: () => apiFetch(`/api/v1/dashboard/groups/${group?.id}/`, { method: "PATCH", body: { whatsapp_url: "" }, idempotencyKey: disableKey.get(payloadSignature("whatsapp-off", group?.id)) }),
    onSuccess() { disableKey.reset(); finish(); },
    onError(error) { disableError(error); setConfirmDisable(false); },
  });

  if (!group || !allowed) return null;
  return (
    <ResourceFormDialog
      key={group.id}
      open
      onOpenChange={onOpenChange}
      title={t("groups.whatsapp.title", { name: group.name })}
      description={group.has_whatsapp_channel ? t("groups.whatsapp.configured") : t("groups.whatsapp.none")}
      specs={specs}
      mode="create"
      crossRules={crossRules}
      pending={save.isPending || disable.isPending}
      serverError={save.error}
      onSubmit={(body) => save.mutate(body)}
    >
      {group.has_whatsapp_channel ? (
        <div className="mb-4">
          <Button type="button" variant="outline" onClick={() => setConfirmDisable(true)} disabled={save.isPending || disable.isPending}><Link2Off />{t("groups.whatsapp.disable")}</Button>
          <AlertDialog open={confirmDisable} onOpenChange={(open) => { if (!disable.isPending) setConfirmDisable(open); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("groups.whatsapp.disableTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("groups.whatsapp.disableDescription", { name: group.name })}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={disable.isPending}>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction disabled={disable.isPending} className="bg-destructive text-destructive-foreground" onClick={(event) => { event.preventDefault(); disable.mutate(); }}>{t("groups.whatsapp.disable")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : null}
    </ResourceFormDialog>
  );
}
