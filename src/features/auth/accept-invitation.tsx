"use client";

import { Check, Circle, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  hasPasswordFieldErrors,
  invitationStateFromError,
  NON_VALID_COPY,
  parseInvitationInfo,
  passwordFieldErrors,
  type InvitationAccepted,
  type InvitationInfo,
} from "@/features/auth/invitation-rules";
import { AuthCard, MIN_PASSWORD, PasswordField, passwordProblem, publicCall } from "@/features/auth/public-auth";
import { useI18n } from "@/i18n/provider";
import { apiErrorText } from "@/lib/api/error-message";

type View =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "info"; info: InvitationInfo }
  | { kind: "done"; email: string };

function Rule({ ok, children }: { ok: boolean; children: string }) {
  return (
    <li className={`flex items-center gap-2 ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`} data-ok={ok ? "true" : "false"}>
      {ok ? <Check className="size-3.5 shrink-0" aria-hidden /> : <Circle className="size-3.5 shrink-0" aria-hidden />}
      <span>{children}</span>
    </li>
  );
}

/** Looks the invitation up. A token the BFF refuses to forward (wrong shape) is not a usable link; anything else failing is transient. */
async function lookUp(token: string): Promise<View> {
  try {
    return { kind: "info", info: parseInvitationInfo(await publicCall("invitation-info", { token })) };
  } catch (failure) {
    const status = (failure as { status?: number }).status;
    return status === 400 || status === 404 ? { kind: "info", info: { state: "unknown" } } : { kind: "failed" };
  }
}

/**
 * /invite/<token>: looks the invitation up FIRST and renders by its state. The password form exists only for a valid
 * invitation; every other state is a plain explanation, so a used, expired or revoked link can never be "submitted".
 * The token is only ever sent to the BFF in a request body; it is never logged or placed in another URL.
 */
export function AcceptInvitation({ token }: { token: string }) {
  const { t } = useI18n();
  const params = useParams<{ locale: string }>();
  const locale = params.locale;
  const [view, setView] = useState<View>({ kind: "loading" });

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void lookUp(token).then((next) => { if (!cancelled) setView(next); });
    return () => { cancelled = true; };
  }, [token, attempt]);
  const retry = () => { setView({ kind: "loading" }); setAttempt((count) => count + 1); };

  // Only the (non-secret) e-mail travels in the query so the login field can be prefilled; never the token or password.
  const login = (email?: string) => `/${locale}/login${email ? `?email=${encodeURIComponent(email)}` : ""}`;

  if (view.kind === "loading") {
    return (
      <AuthCard title={t("publicAuth.inviteTitle")}>
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden />{t("publicAuth.inviteChecking")}</p>
      </AuthCard>
    );
  }
  if (view.kind === "failed") {
    return (
      <AuthCard title={t("publicAuth.inviteTitle")}>
        <p role="alert" className="text-sm font-medium text-destructive">{t("publicAuth.inviteLoadFailed")}</p>
        <Button type="button" className="mt-5 h-12 w-full" onClick={retry}>{t("publicAuth.retry")}</Button>
      </AuthCard>
    );
  }
  if (view.kind === "done") {
    return (
      <AuthCard title={t("publicAuth.inviteDoneTitle")} subtitle={t("publicAuth.inviteDoneBody")}>
        <Button asChild className="h-12 w-full"><Link href={login(view.email)}>{t("auth.signIn")}</Link></Button>
      </AuthCard>
    );
  }

  const { info } = view;
  if (info.state === "valid") {
    return <SetPasswordForm token={token} info={info} onDone={(email) => setView({ kind: "done", email })} onState={(next) => setView({ kind: "info", info: next })} />;
  }
  if (info.state === "accepted") {
    return (
      <AuthCard title={t("publicAuth.inviteAcceptedTitle")} subtitle={info.email_masked ? t("publicAuth.inviteAcceptedBody", { email: info.email_masked }) : t("publicAuth.inviteAcceptedBodyNoEmail")}>
        <div className="space-y-3">
          <Button asChild className="h-12 w-full"><Link href={login()}>{t("auth.signIn")}</Link></Button>
          <Button asChild variant="outline" className="h-12 w-full"><Link href={`/${locale}/forgot-password`}>{t("auth.forgotPassword")}</Link></Button>
        </div>
      </AuthCard>
    );
  }
  const copy = NON_VALID_COPY[info.state];
  return (
    <AuthCard title={t(copy.title)} subtitle={t(copy.body)}>
      <Button asChild variant="outline" className="h-12 w-full"><Link href={login()}>{t("publicAuth.backToLogin")}</Link></Button>
    </AuthCard>
  );
}

function SetPasswordForm({ token, info, onDone, onState }: { token: string; info: InvitationInfo; onDone: (email: string) => void; onState: (info: InvitationInfo) => void }) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const longEnough = password.length >= MIN_PASSWORD;
  const notNumeric = password.length > 0 && !/^\d+$/u.test(password);
  const matches = confirm.length > 0 && password === confirm;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const problem = passwordProblem(password, confirm, t);
    if (problem) { setErrors([problem]); return; }
    setBusy(true); setErrors([]);
    try {
      const result = await publicCall<InvitationAccepted | null>("invitation-accept", { token, password, password_confirm: confirm });
      setPassword(""); setConfirm("");
      onDone(typeof result?.email === "string" ? result.email : "");
    } catch (failure) {
      const next = invitationStateFromError(failure);
      if (next) { onState({ state: next }); return; }
      const fields = passwordFieldErrors(failure);
      if (fields.length > 0) setErrors(fields);
      else if (hasPasswordFieldErrors(failure)) setErrors([t("publicAuth.passwordRejected")]);
      else setErrors([apiErrorText(failure, t)]);
    } finally { setBusy(false); }
  };

  return (
    <AuthCard title={t("publicAuth.inviteTitle")} subtitle={t("publicAuth.inviteBody", { min: MIN_PASSWORD })}>
      {info.full_name ? <p className="-mt-2 mb-4 text-sm font-semibold">{t("publicAuth.inviteFor", { name: info.full_name })}</p> : null}
      <form className="space-y-5" onSubmit={submit} noValidate>
        <PasswordField id="invite-password" label={t("publicAuth.newPassword")} value={password} onChange={setPassword} autoComplete="new-password" />
        <PasswordField id="invite-confirm" label={t("publicAuth.confirmPassword")} value={confirm} onChange={setConfirm} autoComplete="new-password" />
        <ul className="space-y-1 text-xs" aria-label={t("publicAuth.rulesTitle")}>
          <Rule ok={longEnough}>{t("publicAuth.rule.length", { min: MIN_PASSWORD })}</Rule>
          <Rule ok={notNumeric}>{t("publicAuth.rule.notNumeric")}</Rule>
          <Rule ok={matches}>{t("publicAuth.rule.match")}</Rule>
        </ul>
        {errors.length > 0 ? <div role="alert" className="space-y-1 text-sm font-medium text-destructive">{errors.map((message) => <p key={message}>{message}</p>)}</div> : null}
        <Button type="submit" className="h-12 w-full rounded-xl brand-gradient text-white" isLoading={busy} disabled={busy}>{t("publicAuth.setPassword")}</Button>
      </form>
    </AuthCard>
  );
}
