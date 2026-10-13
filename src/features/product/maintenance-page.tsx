"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PowerOff, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ResourceForm, type FormBody } from "@/components/forms/resource-form-dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RESOURCE_DEFINITIONS } from "@/contracts/generated/resource-definitions";
import { RESOURCE_COLUMNS } from "@/features/resources/columns";
import { formSpecsFor, RESOURCE_FORM_POLICIES } from "@/features/resources/resource-form-policy";
import { listResource, type EntityRecord } from "@/features/resources/resource-api";
import { ResourceManager } from "@/features/resources/resource-manager";
import { derivedIdempotencyKey, editableWindow, enabledWindows, maintenanceState } from "@/features/product/maintenance-rules";
import { useCan } from "@/features/session";
import { useI18n } from "@/i18n/provider";
import { useIdempotencyKey, useMutationError } from "@/hooks/use-idempotency-key";
import { apiFetch } from "@/lib/api/browser-client";
import { payloadSignature } from "@/lib/api/idempotency";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { formatDate } from "@/lib/utils";

const definition = RESOURCE_DEFINITIONS["maintenance-modes"];
const NOTICE_FIELDS = ["title_ar", "title_en", "message_ar", "message_en", "estimated_end_at", "retry_after_seconds", "bypass_staff"];

/** Turn maintenance on/off and edit the public notice. Enabling and disabling go through a confirmation. */
function MaintenancePanel() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const canWrite = useCan(CAPABILITIES.product);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const query = useQuery({
    queryKey: ["resource", "maintenance-modes", "panel"],
    queryFn: () => listResource(definition, { page: 1, pageSize: 100, ordering: "-updated_at" }),
  });
  const records = useMemo(() => query.data?.results ?? [], [query.data?.results]);
  const state = maintenanceState(records);
  const active = editableWindow(records);
  const specsCreate = useMemo(() => formSpecsFor("maintenance-modes", "create", {}, NOTICE_FIELDS), []);
  const specsEdit = useMemo(() => formSpecsFor("maintenance-modes", "edit", {}, NOTICE_FIELDS), []);
  const crossRules = RESOURCE_FORM_POLICIES["maintenance-modes"]?.crossRules;

  const saveKey = useIdempotencyKey();
  const saveError = useMutationError(saveKey);
  const save = useMutation({
    mutationFn: (body: FormBody) => {
      const path = definition.collectionPath;
      if (state !== "off" && active?.id != null) return apiFetch(`${path}${active.id}/`, { method: "PATCH", body, idempotencyKey: saveKey.get(payloadSignature("update", active.id, body)) });
      return apiFetch(path, { method: "POST", body: { ...(body as Record<string, unknown>), enabled: true }, idempotencyKey: saveKey.get(payloadSignature("enable", body)) });
    },
    onSuccess() {
      saveKey.reset();
      toast.success(t(state === "off" ? "maintenance.enabledToast" : "common.success"));
      void queryClient.invalidateQueries({ queryKey: ["resource", "maintenance-modes"] });
    },
    onError: saveError,
  });

  const disableKey = useIdempotencyKey();
  const disableError = useMutationError(disableKey);
  const disable = useMutation({
    mutationFn: async () => {
      const base = disableKey.get(payloadSignature("disable", enabledWindows(records).map((record) => record.id)));
      for (const record of enabledWindows(records)) {
        await apiFetch(`${definition.collectionPath}${record.id}/`, { method: "PATCH", body: { enabled: false }, idempotencyKey: derivedIdempotencyKey(base, record.id) });
      }
    },
    onSuccess() {
      disableKey.reset();
      setConfirmDisable(false);
      toast.success(t("maintenance.disabledToast"));
      void queryClient.invalidateQueries({ queryKey: ["resource", "maintenance-modes"] });
    },
    onError: disableError,
  });

  if (query.isPending) return <Skeleton className="h-48 rounded-2xl" />;
  const entity: EntityRecord | null = state === "off" ? null : active;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-3 text-base">
          <Wrench className="size-5 text-primary" />
          <span data-testid="maintenance-state" data-state={state}>{t(`maintenance.state.${state}` as "maintenance.state.off")}</span>
        </CardTitle>
        <CardDescription>
          {state === "off" ? t("maintenance.offHint") : t("maintenance.onHint")}
          {entity?.estimated_end_at ? ` ${t("maintenance.eta", { time: formatDate(entity.estimated_end_at, locale) })}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canWrite ? (
          <ResourceForm
            key={`${state}-${String(entity?.id ?? "new")}-${String(entity?.updated_at ?? "")}`}
            specs={state === "off" ? specsCreate : specsEdit}
            mode={state === "off" ? "create" : "edit"}
            entity={entity}
            crossRules={crossRules}
            pending={save.isPending}
            serverError={save.error}
            submitLabel={t(state === "off" ? "maintenance.enable" : "maintenance.updateNotice")}
            confirm={(payload) => (state === "off" ? t(payload.bypass_staff === false ? "maintenance.confirmEnableNoBypass" : "maintenance.confirmEnable") : null)}
            onSubmit={(body) => save.mutate(body)}
          />
        ) : <p className="text-sm text-muted-foreground">{t("common.readOnlyNotice")}</p>}
        {canWrite && state !== "off" ? (
          <div className="flex justify-end border-t pt-4">
            <Button variant="destructive" onClick={() => setConfirmDisable(true)} disabled={disable.isPending}><PowerOff />{t("maintenance.disable")}</Button>
          </div>
        ) : null}
      </CardContent>
      <AlertDialog open={confirmDisable} onOpenChange={(open) => { if (!open && !disable.isPending) setConfirmDisable(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("maintenance.disableTitle")}</AlertDialogTitle><AlertDialogDescription>{t("maintenance.disableDescription")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disable.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); disable.mutate(); }} disabled={disable.isPending}>{t("maintenance.disable")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export function MaintenancePage() {
  const { t } = useI18n();
  return (
    <ResourceManager
      resourceKey="maintenance-modes"
      title={t("product.maintenance.title")}
      description={t("product.maintenance.subtitle")}
      capability={CAPABILITIES.product}
      columns={RESOURCE_COLUMNS["maintenance-modes"]}
      readOnly
      extraContent={<MaintenancePanel />}
    />
  );
}
