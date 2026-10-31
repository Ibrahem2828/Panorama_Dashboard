"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, History, KeyRound, LogOut, MailPlus, MailWarning, Send, UserRoundPlus } from "lucide-react";
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
import { actionLabel, isResetAction, staffActionErrorText, type ActivityInvitation, type ResendResult } from "@/features/users/invitation-rules";
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

const ARABIC = /[؀-ۿ]/u;

/** `POST dashboard/users/<id>/resend-invitation/`: the server's Arabic message, the purpose and whether the e-mail left. */
async function postResend(userId: number): Promise<{ message: string | null; data: ResendResult }> {
  const response = await apiFetch(`/api/v1/dashboard/users/${userId}/resend-invitation/`, { method: "POST", body: {} });
  const payload = (await response.json().catch(() => ({}))) as { message?: unknown; data?: ResendResult | null };
  const message = typeof payload.message === "string" && ARABIC.test(payload.message) ? payload.message : null;
  return { message, data: payload.data && typeof payload.data === "object" ? payload.data : {} };
}

interface InviteResult { email: string; id: number | null; emailSent: boolean; mode: "link" | "temporary_password" }

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
  const [result, setResult] = useState<InviteResult | null>(null);
  const keys = useIdempotencyKey();
  const keyError = useMutationError(keys);
  const active = (templates.data?.results ?? []).filter((template) => template.is_active);
  const chosen = active.find((template) => String(template.id) === templateId);
  const valid = fullName.trim().length >= 2 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email.trim()) && phone.trim().length >= 6 && Boolean(chosen);

  const invite = useMutation({
    mutationFn: async () => {
      const response = await apiFetch("/api/v1/dashboard/users/invite/", {
        method: "POST",
        body: { full_name: fullName.trim(), email: email.trim(), phone_number: phone.trim(), template: Number(templateId), mode },
        idempotencyKey: keys.get(`${email}|${templateId}|${mode}`),
      });
      return (await response.json().catch(() => ({}))) as { data?: { id?: unknown; email_sent?: unknown; user?: { id?: unknown } } | null };
    },
    onSuccess: (payload) => {
      keys.reset();
      const data = payload.data ?? {};
      const id = Number(data.id ?? data.user?.id);
      setResult({ email: email.trim(), id: Number.isInteger(id) && id > 0 ? id : null, emailSent: data.email_sent !== false, mode });
      void queryClient.invalidateQueries({ queryKey: ["resource", "users"] });
    },
    onError: keyError,
  });

  const retry = useMutation({
    mutationFn: () => postResend(result?.id ?? 0),
    onSuccess: ({ data }) => {
      if (data.email_sent === false) { toast.warning(t("staff.emailNotSent")); return; }
      toast.success(t("staff.inviteResent"));
      setResult((current) => (current ? { ...current, emailSent: true } : current));
    },
    onError: (error) => toast.error(staffActionErrorText(error, t)),
  });

  if (result) {
    return (
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("staff.addUser")}</DialogTitle><DialogDescription className="sr-only">{t("staff.addUserHint")}</DialogDescription></DialogHeader>
          {result.emailSent ? (
            <p role="status" data-testid="invite-result" className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
              <span>{t(result.mode === "link" ? "staff.inviteSentTo" : "staff.inviteCreatedTempTo", { email: result.email })}</span></p>
          ) : (
            <p role="alert" data-testid="invite-result-warning" className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm"><MailWarning className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
              <span>{t("staff.inviteNotEmailed", { email: result.email })}</span></p>
          )}
          <DialogFooter>
            {!result.emailSent && result.id ? <Button type="button" variant="outline" onClick={() => retry.mutate()} isLoading={retry.isPending}><Send className="size-4" />{t("staff.retryEmail")}</Button> : null}
            <Button type="button" onClick={onClose}>{t("staff.done")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

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
  invitation?: ActivityInvitation;
  recent_actions: { id: number; action: string; action_label?: string | null; target_type: string; target_id: string; ip_address: string | null; created_at: string }[];
}

function useUserAction(userId: number, path: string, success: MessageKey, refresh: () => Promise<unknown>) {
  const { t } = useI18n();
  return useMutation({
    mutationFn: () => apiFetch(`/api/v1/dashboard/users/${userId}/${path}/`, { method: "POST", body: {} }),
    onSuccess: async () => { toast.success(t(success)); await refresh(); },
    onError: (error) => toast.error(staffActionErrorText(error, t)),
  });
}

/** One line (plus an optional warning) describing the invitation, by state. */
function InvitationSummary({ data }: { data: Activity }) {
  const { t, locale } = useI18n();
  const invitation = data.invitation;
  if (!invitation || invitation.state === "none") {
    return data.invitation_pending ? <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">{t("staff.invitePending", { date: data.invitation_expires_at ? formatDate(data.invitation_expires_at, locale) : "" })}</p> : null;
  }
  const sentAt = invitation.delivery?.sent_at ?? invitation.last_sent_at ?? null;
  let line: string;
  if (invitation.state === "accepted") line = invitation.accepted_at ? t("staff.invite.acceptedAt", { date: formatDate(invitation.accepted_at, locale) }) : t("staff.invite.acceptedNoDate");
  else if (invitation.state === "expired") line = t("staff.invite.expiredLine");
  else if (invitation.state === "revoked") line = t("staff.invite.revokedLine");
  else line = `${t("staff.invite.pendingLine")}${data.invitation_expires_at ? ` — ${t("staff.invite.expires", { date: formatDate(data.invitation_expires_at, locale) })}` : ""}`;
  const status = invitation.delivery?.status;
  return (
    <div className="space-y-2">
      <p className={`rounded-lg border p-3 ${invitation.state === "pending" ? "border-amber-500/40 bg-amber-500/10" : ""}`} data-testid="invitation-state">{line}</p>
      {status === "failed" ? (
        <p role="alert" data-testid="invitation-delivery-failed" className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 font-medium"><MailWarning className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />{t("staff.invite.deliveryFailed")}</p>
      ) : status === "ok" && sentAt ? (
        <p data-testid="invitation-delivery-ok" className="px-1 text-xs text-muted-foreground">{t("staff.invite.deliveryOk", { date: formatDate(sentAt, locale) })}</p>
      ) : null}
    </div>
  );
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
  const revoke = useUserAction(user.id, "revoke-invitation", "staff.inviteRevoked", refresh);
  const resend = useMutation({
    mutationFn: () => postResend(user.id),
    onSuccess: async ({ message, data }) => {
      if (data.email_sent === false) toast.warning(t("staff.emailNotSent"));
      else toast.success(message ?? t(data.purpose === "reset" ? "staff.resetSent" : "staff.inviteResent"));
      await refresh();
    },
    onError: (error) => toast.error(staffActionErrorText(error, t)),
  });
  const data = activity.data;
  const reset = isResetAction(data?.invitation);

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
            <InvitationSummary data={data} />
            {data.must_change_password ? <p className="rounded-lg border p-3">{t("staff.mustChange")}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" size="sm" disabled={endSessions.isPending || data.active_sessions === 0} onClick={() => { if (window.confirm(t("staff.confirmEndSessions"))) endSessions.mutate(); }}><LogOut className="size-4" />{t("staff.endSessions")}</Button>
              <Button variant="outline" size="sm" disabled={resend.isPending} onClick={() => { if (!reset || window.confirm(t("staff.confirmReset"))) resend.mutate(); }}>{reset ? <KeyRound className="size-4" /> : <Send className="size-4" />}{t(reset ? "staff.sendReset" : "staff.resendInvite")}</Button>
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
                      <span>{actionLabel(row, t, enumLabel)}{row.target_type ? <span className="ms-2 text-xs text-muted-foreground">{row.target_type} #{row.target_id}</span> : null}</span>
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
