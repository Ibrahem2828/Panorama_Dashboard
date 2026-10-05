"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ShieldCheck, Trash2, UserRoundCog } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ErrorPanel } from "@/components/feedback/error-panel";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DASHBOARD_ROLES, type DashboardRole } from "@/config/constants";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { apiFetch, normalizeCollection, unwrap } from "@/lib/api/browser-client";
import { useI18n } from "@/i18n/provider";
import { humanize } from "@/lib/utils";
import type { ApiEnvelope } from "@/types/api";

type User = Record<string, unknown> & { id: number; full_name: string; email: string; role: DashboardRole; effective_capabilities?: string[]; overrides?: Override[] };
type Override = { id?: number; permission_code: string; effect: "allow" | "deny"; expires_at?: string | null; reason?: string };

export function RbacPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Override>({ permission_code: CAPABILITIES.dashboard, effect: "allow", expires_at: null, reason: "" });

  const users = useQuery({
    queryKey: ["rbac-users"],
    queryFn: async () => normalizeCollection<User>(await apiFetch("/api/v1/dashboard/users/?page_size=200&ordering=full_name")).results,
  });
  const capabilities = useQuery({
    queryKey: ["capabilities"],
    queryFn: async () => {
      const payload = await unwrap(apiFetch<ApiEnvelope<{ capabilities?: string[] }> | { capabilities?: string[] }>("/api/v1/dashboard/capabilities/"));
      return payload?.capabilities ?? [];
    },
  });
  const selected = useMemo(() => users.data?.find((user) => user.id === selectedUserId) ?? users.data?.[0] ?? null, [selectedUserId, users.data]);

  const save = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("Select a user first.");
      return apiFetch(`/api/v1/dashboard/users/${selected.id}/permission-overrides/`, { method: "PUT", body: form });
    },
    onSuccess() { toast.success(t("common.success")); setOpen(false); void queryClient.invalidateQueries({ queryKey: ["rbac-users"] }); },
    onError(error: Error) { toast.error(error.message); },
  });
  const remove = useMutation({
    mutationFn: (permissionCode: string) => {
      if (!selected) throw new Error("Select a user first.");
      return apiFetch(`/api/v1/dashboard/users/${selected.id}/permission-overrides/`, { method: "DELETE", body: { permission_code: permissionCode } });
    },
    onSuccess() { toast.success(t("common.success")); void queryClient.invalidateQueries({ queryKey: ["rbac-users"] }); },
    onError(error: Error) { toast.error(error.message); },
  });

  if (users.isError) return <ErrorPanel error={users.error} retry={() => users.refetch()} />;
  return (
    <div className="space-y-6">
      <PageHeader title={t("rbac.title")} description={t("rbac.subtitle")} eyebrow="RBAC / CAPABILITIES" actions={<Button onClick={() => setOpen(true)} disabled={!selected}><Plus />{t("rbac.addOverride")}</Button>} />
      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <Card className="h-fit xl:sticky xl:top-24">
          <CardHeader><CardTitle className="flex items-center gap-2"><UserRoundCog className="text-primary" />{t("nav.users")}</CardTitle><CardDescription>{users.data?.length ?? 0} {t("rbac.accounts")}</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {users.isPending ? Array.from({ length: 6 }).map((_, i) => <Skeleton className="h-14 rounded-xl" key={i} />) : users.data?.map((user) => (
              <button key={user.id} type="button" onClick={() => setSelectedUserId(user.id)} className={`w-full rounded-xl border p-3 text-start transition ${selected?.id === user.id ? "border-primary/35 bg-primary/8" : "hover:bg-muted"}`}>
                <div className="truncate font-bold">{user.full_name}</div><div className="mt-1 flex items-center justify-between gap-2"><span className="truncate text-xs text-muted-foreground">{user.email}</span><StatusPill value={user.role} /></div>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-5">
          {selected ? (
            <>
              <Card className="overflow-hidden">
                <CardHeader className="brand-gradient text-white"><CardTitle>{selected.full_name}</CardTitle><CardDescription className="text-white/70">{selected.email} · {t(`roles.${selected.role}` as "roles.admin")}</CardDescription></CardHeader>
                <CardContent className="p-5">
                  <div className="mb-3 text-sm font-bold">{t("users.effectiveCapabilities")}</div>
                  <div className="flex flex-wrap gap-2">{(selected.effective_capabilities ?? []).map((capability) => <span key={capability} className="rounded-full border bg-muted px-3 py-1 text-xs font-mono">{capability}</span>)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>{t("users.overrides")}</CardTitle><CardDescription>{t("rbac.subtitle")}</CardDescription></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-xl border">
                    <Table><TableHeader><TableRow><TableHead>Capability</TableHead><TableHead>Effect</TableHead><TableHead>{t("rbac.expiresAt")}</TableHead><TableHead>{t("rbac.reason")}</TableHead><TableHead /></TableRow></TableHeader>
                      <TableBody>{(selected.overrides ?? []).map((item) => <TableRow key={item.permission_code}><TableCell className="font-mono text-xs">{item.permission_code}</TableCell><TableCell><StatusPill value={item.effect} /></TableCell><TableCell>{item.expires_at ?? "â€”"}</TableCell><TableCell>{item.reason || "â€”"}</TableCell><TableCell><Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove.mutate(item.permission_code)}><Trash2 /></Button></TableCell></TableRow>)}{!(selected.overrides ?? []).length ? <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">{t("common.noData")}</TableCell></TableRow> : null}</TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : <Skeleton className="h-96 rounded-2xl" />}

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="text-primary" />{t("rbac.roleBaseline")}</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table><TableHeader><TableRow><TableHead>Capability</TableHead>{DASHBOARD_ROLES.map((role) => <TableHead key={role} className="min-w-28 text-center">{t(`roles.${role}` as "roles.admin")}</TableHead>)}</TableRow></TableHeader><TableBody>{Object.values(CAPABILITIES).map((capability) => <TableRow key={capability}><TableCell className="font-mono text-xs">{capability}</TableCell>{DASHBOARD_ROLES.map((role) => <TableCell key={role} className="text-center">{Boolean(capabilities.data?.includes(capability)) ? <span className="text-emerald-600">â—</span> : <span className="text-muted-foreground/30">â€”</span>}</TableCell>)}</TableRow>)}</TableBody></Table>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("rbac.addOverride")}</DialogTitle><DialogDescription>{selected?.full_name}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-2"><Label>{t("rbac.capability")}</Label><Select value={form.permission_code} onValueChange={(value) => setForm((current) => ({ ...current, permission_code: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(capabilities.data ?? Object.values(CAPABILITIES)).map((capability) => <SelectItem value={capability} key={capability}>{humanize(capability)}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>{t("rbac.effect")}</Label><Select value={form.effect} onValueChange={(value: "allow" | "deny") => setForm((current) => ({ ...current, effect: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="allow">{t("rbac.allow")}</SelectItem><SelectItem value="deny">{t("rbac.deny")}</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>{t("rbac.expiresAt")}</Label><Input type="datetime-local" value={form.expires_at ?? ""} onChange={(event) => setForm((current) => ({ ...current, expires_at: event.target.value || null }))} /></div>
            <div className="space-y-2"><Label>{t("rbac.reason")}</Label><Input value={form.reason ?? ""} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} maxLength={255} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button><ConfirmDialog trigger={<Button disabled={save.isPending}>{t("common.save")}</Button>} title={t("rbac.confirmChange")} description={t("common.destructiveWarning")} confirmLabel={t("common.save")} cancelLabel={t("common.cancel")} onConfirm={() => save.mutate()} /></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


