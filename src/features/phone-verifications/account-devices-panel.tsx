"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, RotateCcw, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorPanel } from "@/components/feedback/error-panel";
import { StatusPill } from "@/components/shared/status-pill";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  canResetDevice, deviceBoundViaKey, deviceHistory, deviceNotice, deviceStatusKey, normalizeReason, REJECT_REASON_MAX, switchSummary,
  type AccountDevice, type AccountDevicesData,
} from "@/features/phone-verifications/phone-verification-rules";
import { useIdempotencyKey, useMutationError } from "@/hooks/use-idempotency-key";
import { useI18n } from "@/i18n/provider";
import { apiFetch, unwrap } from "@/lib/api/browser-client";
import { payloadSignature } from "@/lib/api/idempotency";
import { formatDate } from "@/lib/utils";
import type { ApiEnvelope } from "@/types/api";

/**
 * Student device binding (`GET/POST /api/v1/dashboard/users/{id}/account-devices/`). It is NOT the push-installation
 * devices screen under Product: this is the one phone a student may sign in from.
 */
export function AccountDevicesPanel({ userId }: { userId: number }) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const key = useIdempotencyKey();
  const onError = useMutationError(key);
  const queryKey = ["account-devices", userId];
  const query = useQuery({
    queryKey,
    queryFn: () => unwrap(apiFetch<ApiEnvelope<AccountDevicesData>>(`/api/v1/dashboard/users/${userId}/account-devices/`)),
  });
  const reset = useMutation({
    mutationFn: async () => {
      const body = { reason: normalizeReason(reason) ?? "" };
      return apiFetch(`/api/v1/dashboard/users/${userId}/account-devices/reset/`, { method: "POST", body, idempotencyKey: key.get(payloadSignature("reset-device", userId, body)) });
    },
    onSuccess: async () => {
      key.reset();
      toast.success(t("accountDevices.resetDone"));
      setConfirming(false);
      setReason("");
      await queryClient.invalidateQueries({ queryKey });
    },
    onError,
  });

  if (query.isPending) return <Skeleton className="h-48 w-full rounded-2xl" aria-busy="true" />;
  if (query.isError) return <ErrorPanel error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  const notice = deviceNotice(data);
  const counter = switchSummary(data);
  const history = deviceHistory(data);
  const when = (value: string | null) => (value ? formatDate(value, locale) : "—");

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("accountDevices.intro")}</p>
      {notice ? (
        <p role="status" className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm font-medium text-amber-800 dark:text-amber-200">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />{notice === "not_enforced" ? t("accountDevices.notEnforced") : t("accountDevices.notApplicable")}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-2 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold"><Smartphone className="size-4" aria-hidden />{t("accountDevices.active")}</h3>
          {data.active_device ? <ActiveDevice device={data.active_device} when={when} /> : <p className="text-sm text-muted-foreground">{t("accountDevices.noActive")}</p>}
        </Card>
        <Card className="space-y-2 p-4">
          <h3 className="text-sm font-bold">{t("accountDevices.switches")}</h3>
          <p className="text-2xl font-extrabold tabular-nums" data-testid="device-switches">{counter.used} / {counter.limit}</p>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden><div className={counter.exhausted ? "h-full bg-destructive" : "h-full bg-primary"} style={{ width: `${Math.round(counter.ratio * 100)}%` }} /></div>
          <p className="text-xs text-muted-foreground">{t("accountDevices.switchesHint", { days: data.window_days, remaining: counter.remaining })}</p>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button variant="destructive" disabled={!canResetDevice(data)} onClick={() => setConfirming(true)}><RotateCcw />{t("accountDevices.reset")}</Button>
      </div>

      <section aria-labelledby="account-devices-history" className="space-y-2">
        <h3 id="account-devices-history" className="text-sm font-bold">{t("accountDevices.history")}</h3>
        {history.length === 0 ? <Card className="p-6 text-center text-sm text-muted-foreground">{t("accountDevices.noHistory")}</Card> : (
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("accountDevices.device")}</TableHead><TableHead>{t("common.status")}</TableHead><TableHead>{t("accountDevices.boundVia")}</TableHead>
                <TableHead>{t("accountDevices.boundAt")}</TableHead><TableHead>{t("accountDevices.replacedAt")}</TableHead><TableHead>{t("accountDevices.lastSeen")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {history.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell className="font-medium" dir="auto">{device.name || t("accountDevices.unnamed")}{device.platform ? <span className="ms-2 text-xs text-muted-foreground">{device.platform}</span> : null}</TableCell>
                    <TableCell><StatusPill value={device.status === "revoked" ? "rejected" : "draft"} label={t(deviceStatusKey(device.status))} /></TableCell>
                    <TableCell>{t(deviceBoundViaKey(device.bound_via))}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{when(device.bound_at)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{when(device.replaced_at)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{when(device.last_seen_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>

      <AlertDialog open={confirming} onOpenChange={(open) => { if (!open && !reset.isPending) { setConfirming(false); setReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("accountDevices.resetTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("accountDevices.resetWarning")}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="account-device-reason">{t("accountDevices.reason")}<span className="ms-1 text-destructive" aria-hidden="true">*</span></Label>
            <Textarea id="account-device-reason" value={reason} maxLength={REJECT_REASON_MAX} aria-required onChange={(event) => setReason(event.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reset.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <Button variant="destructive" onClick={() => reset.mutate()} disabled={normalizeReason(reason) === null} isLoading={reset.isPending}>{t("accountDevices.confirmReset")}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ActiveDevice({ device, when }: { device: AccountDevice; when: (value: string | null) => string }) {
  const { t } = useI18n();
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      <dt className="text-muted-foreground">{t("accountDevices.device")}</dt><dd className="font-medium" dir="auto">{device.name || t("accountDevices.unnamed")}</dd>
      <dt className="text-muted-foreground">{t("accountDevices.platform")}</dt><dd>{device.platform || "—"}</dd>
      <dt className="text-muted-foreground">{t("accountDevices.boundAt")}</dt><dd>{when(device.bound_at)}</dd>
      <dt className="text-muted-foreground">{t("accountDevices.lastSeen")}</dt><dd>{when(device.last_seen_at)}</dd>
      <dt className="text-muted-foreground">{t("accountDevices.boundVia")}</dt><dd>{t(deviceBoundViaKey(device.bound_via))}</dd>
    </dl>
  );
}
