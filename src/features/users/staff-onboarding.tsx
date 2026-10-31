"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, History, KeyRound, LogOut, MailPlus, Send, UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ReasonBadge } from "@/features/system-activity/reason-badge";
import { useIdempotencyKey, useMutationError } from "@/hooks/use-idempotency-key";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/messages";
import { apiFetch, normalizeCollection, unwrap } from "@/lib/api/browser-client";
import { formatDate } from "@/lib/utils";

export interface PermissionTemplate {
  id: number; key: string; name_ar: string; name_en: string; description: string; role: string;
  capabilities: string[]; is_system: boolean; is_active: boolean; warnings: string[];
}

export function useTemplates() {
  return useQuery({
    queryKey: ["permission-templates"],
    queryFn: async () => normalizeCollection<PermissionTemplate>(await apiFetch("/api/v1/dashboard/permission-templates/?page_size=100")),
  });
}

/** Plain-language name of a capability code (falls back to the code itself). */
export function useCapabilityLabel() {
  const { t } = useI18n();
  return (code: string) => {
    const key = `capability.${code}` as MessageKey;
    const label = t(key);
    return label === key ? code : label;
  };
}

/** "Add user": name, e-mail, phone, a ready template and how they get in (invite link or temporary password). */
export function InviteUserDialog({ onClose }: { onClose: () => void }) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const capabilityLabel = useCapabilityLabel();
  const templates = useTemplates();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [mode, setMode] = useState<"link" | "temporary_password">("link");
  const [touched, setTouched] = useState(false);
  const keys = useIdempotencyKey();
  const keyError = useMutationError(keys);
  const active = (templates.data?.results ?? []).filter((template) => template.is_active);
  const chosen = active.find((template) => String(template.id) === templateId);
  const valid = fullName.trim().length >= 2 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email.trim()) && phone.trim().length >= 6 && Boolean(chosen);

  const invite = useMutation({
    mutationFn: () => apiFetch("/api/v1/dashboard/users/invite/", {
      method: "POST",
      body: { full_name: fullName.trim(), email: email.trim(), phone_number: phone.trim(), template: Number(templateId), mode },
      idempotencyKey: keys.get(`${email}|${templateId}|${mode}`),
    }),
    onSuccess: () => { keys.reset(); toast.success(t("staff.invited")); void queryClient.invalidateQueries({ queryKey: ["resource", "users"] }); onClose(); },
    onError: keyError,
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !invite.isPending) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t("staff.addUser")}</DialogTitle><DialogDescription>{t("staff.addUserHint")}</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); setTouched(true); if (valid && !invite.isPending) invite.mutate(); }}>
          <div className="space-y-2"><Label htmlFor="inv-name">{t("staff.fullName")}</Label><Input id="inv-name" autoFocus value={fullName} maxLength={255} onChange={(event) => setFullName(event.target.value)} aria-invalid={touched && fullName.trim().length < 2 ? true : undefined} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="inv-email">{t("staff.email")}</Label><Input id="inv-email" type="email" dir="ltr" className="text-start" value={email} maxLength={254} onChange={(event) => setEmail(event.target.value)} aria-invalid={touched && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email.trim()) ? true : undefined} /></div>
            <div className="space-y-2"><Label htmlFor="inv-phone">{t("staff.phone")}</Label><Input id="inv-phone" dir="ltr" className="text-start" inputMode="tel" placeholder="+9639xxxxxxxx" value={phone} maxLength={32} onChange={(event) => setPhone(event.target.value)} aria-invalid={touched && phone.trim().length < 6 ? true : undefined} /></div>
          </div>
          <div className="space-y-2">
            <Label>{t("staff.template")}</Label>
            {templates.isLoading ? <Skeleton className="h-10 w-full" /> : (
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger aria-invalid={touched && !chosen ? true : undefined}><SelectValue placeholder={t("staff.pickTemplate")} /></SelectTrigger>
                <SelectContent>{active.map((template) => <SelectItem key={template.id} value={String(template.id)}>{locale === "ar" ? template.name_ar : template.name_en}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {chosen ? (
              <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                {chosen.description ? <p className="mb-2 text-muted-foreground">{chosen.description}</p> : null}
                <div className="flex flex-wrap gap-1">{chosen.capabilities.map((code) => <Badge key={code} variant={chosen.warnings.includes(code) ? "destructive" : "secondary"}>{capabilityLabel(code)}</Badge>)}</div>
                {chosen.warnings.length > 0 ? <p className="mt-2 flex items-center gap-1 font-semibold text-destructive"><AlertTriangle className="size-3.5" />{t("staff.dangerous")}</p> : null}
              </div>
            ) : null}
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("staff.entryMode")}</legend>
            {(["link", "temporary_password"] as const).map((value) => (
              <label key={value} className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm">
                <input type="radio" name="inv-mode" className="mt-1" checked={mode === value} onChange={() => setMode(value)} />
                <span><span className="font-semibold">{t(`staff.mode.${value}` as MessageKey)}</span><span className="block text-xs text-muted-foreground">{t(`staff.mode.${value}Hint` as MessageKey)}</span></span>
              </label>
            ))}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={invite.isPending}>{t("common.cancel")}</Button>
            <Button type="submit" isLoading={invite.isPending}><MailPlus className="size-4" />{t("staff.sendInvite")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface Activity {
  last_login: string | null; last_password_change_at: string | null; active_sessions: number; must_change_password: boolean;
  invitation_pending: boolean; invitation_expires_at: string | null;
  /** Newer backends: the last 10 sign-in attempts and the invitation lifecycle (absent on older ones). */
  recent_logins?: { at: string; kind: "login_success" | "login_failed"; ip: string | null; reason: string | null }[];
  invitation?: { state: "pending" | "accepted" | "expired" | "revoked" | "none"; mode?: string | null; last_sent_at?: string | null };
  recent_actions: { id: number; action: string; target_type: string; target_id: string; ip_address: string | null; created_at: string }[];
}

function useUserAction(userId: number, path: string, success: MessageKey, refresh: () => Promise<unknown>) {
  const { t } = useI18n();
  return useMutation({
    mutationFn: () => apiFetch(`/api/v1/dashboard/users/${userId}/${path}/`, { method: "POST", body: {} }),
    onSuccess: async () => { toast.success(t(success)); await refresh(); },
    onError: () => toast.error(t("staff.actionFailed")),
  });
}

/** Last login, live sessions, the user's recent audited actions, and the buttons to end sessions or resend an invitation. */
export function UserActivityDialog({ user, onClose }: { user: { id: number; full_name: string }; onClose: () => void }) {
  const { t, locale, enumLabel } = useI18n();
  const queryClient = useQueryClient();
  const activity = useQuery({
    queryKey: ["user-activity", user.id],
    queryFn: async () => unwrap<Activity>(apiFetch(`/api/v1/dashboard/users/${user.id}/activity/`)) as Promise<Activity>,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["user-activity", user.id] });
  const endSessions = useUserAction(user.id, "end-sessions", "staff.sessionsEnded", refresh);
  const resend = useUserAction(user.id, "resend-invitation", "staff.inviteResent", refresh);
  const revoke = useUserAction(user.id, "revoke-invitation", "staff.inviteRevoked", refresh);
  const data = activity.data;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{t("staff.activityTitle", { name: user.full_name })}</DialogTitle><DialogDescription>{t("staff.activityHint")}</DialogDescription></DialogHeader>
        {activity.isLoading || !data ? <Skeleton className="h-40 w-full" /> : (
          <div className="space-y-4 text-sm">
            <dl className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">{t("staff.lastLogin")}</dt><dd className="font-semibold">{data.last_login ? formatDate(data.last_login, locale) : t("staff.never")}</dd></div>
              <div className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">{t("staff.activeSessions")}</dt><dd className="font-semibold">{data.active_sessions}</dd></div>
              <div className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">{t("staff.passwordChanged")}</dt><dd className="font-semibold">{data.last_password_change_at ? formatDate(data.last_password_change_at, locale) : "—"}</dd></div>
            </dl>
            {data.invitation && data.invitation.state !== "none" ? (
              <p className={`rounded-lg border p-3 ${data.invitation.state === "pending" ? "border-amber-500/40 bg-amber-500/10" : ""}`} data-testid="invitation-state">
                {t("staff.invite.line", { state: t(`staff.invite.state.${data.invitation.state}` as "staff.invite.state.pending") })}
                {data.invitation.state === "pending" && data.invitation_expires_at ? ` — ${t("staff.invite.expires", { date: formatDate(data.invitation_expires_at, locale) })}` : ""}
                {data.invitation.last_sent_at ? ` — ${t("staff.invite.lastSent", { date: formatDate(data.invitation.last_sent_at, locale) })}` : ""}
              </p>
            ) : data.invitation_pending ? <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">{t("staff.invitePending", { date: data.invitation_expires_at ? formatDate(data.invitation_expires_at, locale) : "" })}</p> : null}
            {data.must_change_password ? <p className="rounded-lg border p-3">{t("staff.mustChange")}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" size="sm" disabled={endSessions.isPending || data.active_sessions === 0} onClick={() => { if (window.confirm(t("staff.confirmEndSessions"))) endSessions.mutate(); }}><LogOut className="size-4" />{t("staff.endSessions")}</Button>
              <Button variant="outline" size="sm" disabled={resend.isPending} onClick={() => resend.mutate()}><Send className="size-4" />{t("staff.resendInvite")}</Button>
              {(data.invitation ? data.invitation.state === "pending" : data.invitation_pending) ? <Button variant="outline" size="sm" disabled={revoke.isPending} onClick={() => revoke.mutate()}>{t("staff.revokeInvite")}</Button> : null}
            </div>
            {data.recent_logins ? (
              <div data-testid="recent-logins">
                <h3 className="mb-2 flex items-center gap-1 font-semibold"><KeyRound className="size-4" />{t("staff.recentLogins")}</h3>
                {data.recent_logins.length === 0 ? <p className="text-muted-foreground">{t("staff.noLogins")}</p> : (
                  <ul className="max-h-56 divide-y overflow-y-auto rounded-lg border">
                    {data.recent_logins.map((row, index) => (
                      <li key={`${row.at}-${index}`} className="flex flex-wrap items-center justify-between gap-2 p-2">
                        <span className="flex flex-wrap items-center gap-2">
                          {row.kind === "login_success" ? <Badge variant="success">{t("staff.loginOk")}</Badge> : <><Badge variant="destructive">{t("staff.loginFailed")}</Badge><ReasonBadge reason={row.reason} /></>}
                          {row.ip ? <span dir="ltr" className="font-mono text-xs text-muted-foreground">{row.ip}</span> : null}
                        </span>
                        <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(row.at, locale)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
            <div>
              <h3 className="mb-2 flex items-center gap-1 font-semibold"><History className="size-4" />{t("staff.recentActions")}</h3>
              {data.recent_actions.length === 0 ? <p className="text-muted-foreground">{t("staff.noActions")}</p> : (
                <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border">
                  {data.recent_actions.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-3 p-2">
                      <span>{enumLabel(row.action)}{row.target_type ? <span className="ms-2 text-xs text-muted-foreground">{row.target_type} #{row.target_id}</span> : null}</span>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(row.created_at, locale)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function StaffHeaderActions({ onAdd }: { onAdd: () => void }) {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <>
      <Button asChild variant="outline"><Link href={`/${locale}/dashboard/users/templates`}>{t("staff.templates")}</Link></Button>
      <Button onClick={onAdd}><UserRoundPlus className="size-4" />{t("staff.addUser")}</Button>
    </>
  );
}
