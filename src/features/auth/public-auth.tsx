"use client";

import { Eye, EyeOff, LockKeyhole, MailCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/provider";
import { bffFetch } from "@/lib/api/browser-client";
import { apiErrorText } from "@/lib/api/error-message";

const MIN_PASSWORD = 10;

/** Signed-out call to the BFF's allowlisted public actions; resolves with the backend `data`, rejects with the API error. */
async function publicCall<T = unknown>(action: string, body: Record<string, unknown>): Promise<T> {
  const response = await bffFetch(`/api/auth/public/${action}`, { method: "POST", body });
  const payload = (await response.json()) as { data?: T };
  return payload.data as T;
}

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="panorama-grid pointer-events-none absolute inset-0" />
      <div className="glass-panel relative w-full max-w-md rounded-[1.75rem] border p-6 sm:p-9">
        <Image src="/brand/logo-512.png" alt="Panorama" width={512} height={362} priority className="mx-auto mb-6 h-auto w-48" />
        <h1 className="text-2xl font-black tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm leading-7 text-muted-foreground">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

function PasswordField({ id, label, value, onChange, autoComplete }: { id: string; label: string; value: string; onChange: (value: string) => void; autoComplete: string }) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <LockKeyhole className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input id={id} type={show ? "text" : "password"} autoComplete={autoComplete} className="h-12 px-10" value={value} maxLength={128} onChange={(event) => onChange(event.target.value)} />
        <Button type="button" variant="ghost" size="icon" className="absolute end-1 top-1/2 -translate-y-1/2" onClick={() => setShow((current) => !current)} aria-label={show ? t("auth.hidePassword") : t("auth.showPassword")}>
          {show ? <EyeOff /> : <Eye />}
        </Button>
      </div>
    </div>
  );
}

/** Password rules the person sees before submitting (the backend remains the authority and may add its own messages). */
function passwordProblem(password: string, confirm: string, t: ReturnType<typeof useI18n>["t"]): string | null {
  if (password.length < MIN_PASSWORD) return t("publicAuth.passwordShort", { min: MIN_PASSWORD });
  if (/^\d+$/u.test(password)) return t("publicAuth.passwordNumeric");
  if (password !== confirm) return t("publicAuth.passwordMismatch");
  return null;
}

/** /invite/<token>: the invited person chooses their password once. */
export function AcceptInvitationForm({ token }: { token: string }) {
  const { t } = useI18n();
  const params = useParams<{ locale: string }>();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const problem = passwordProblem(password, confirm, t);
    if (problem) { setError(problem); return; }
    setBusy(true); setError(null);
    try {
      await publicCall("invitation-accept", { token, password, password_confirm: confirm });
      setDone(true);
    } catch (failure) {
      const text = apiErrorText(failure, t);
      setError(text);
      if ((failure as { status?: number }).status === 400 && /invalid|expired|منتهي|غير صالح/iu.test(String((failure as Error).message))) setInvalid(true);
    } finally { setBusy(false); }
  };

  if (done) {
    return (
      <AuthCard title={t("publicAuth.inviteDoneTitle")} subtitle={t("publicAuth.inviteDoneBody")}>
        <Button asChild className="h-12 w-full"><Link href={`/${params.locale}/login`}>{t("auth.signIn")}</Link></Button>
      </AuthCard>
    );
  }
  return (
    <AuthCard title={t("publicAuth.inviteTitle")} subtitle={invalid ? t("publicAuth.inviteInvalid") : t("publicAuth.inviteBody", { min: MIN_PASSWORD })}>
      <form className="space-y-5" onSubmit={submit} noValidate>
        <PasswordField id="invite-password" label={t("publicAuth.newPassword")} value={password} onChange={setPassword} autoComplete="new-password" />
        <PasswordField id="invite-confirm" label={t("publicAuth.confirmPassword")} value={confirm} onChange={setConfirm} autoComplete="new-password" />
        {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
        <Button type="submit" className="h-12 w-full rounded-xl brand-gradient text-white" isLoading={busy} disabled={busy}>{t("publicAuth.setPassword")}</Button>
      </form>
    </AuthCard>
  );
}

/** /forgot-password: e-mail a code, then choose a new password. */
export function ForgotPasswordForm() {
  const { t } = useI18n();
  const params = useParams<{ locale: string }>();
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email.trim())) { setError(t("publicAuth.emailInvalid")); return; }
    setBusy(true); setError(null);
    try {
      await publicCall("password-reset-request", { identifier: email.trim() });
      // The backend answers the same way whether the account exists or not, so neither do we.
      setStep("code");
    } catch (failure) { setError(apiErrorText(failure, t)); } finally { setBusy(false); }
  };
  const confirmReset = async (event: FormEvent) => {
    event.preventDefault();
    const problem = !/^\d{6}$/u.test(code) ? t("publicAuth.codeInvalid") : passwordProblem(password, confirm, t);
    if (problem) { setError(problem); return; }
    setBusy(true); setError(null);
    try {
      await publicCall("password-reset-confirm", { identifier: email.trim(), code, new_password: password, new_password_confirm: confirm });
      toast.success(t("publicAuth.resetDone"));
      setStep("done");
    } catch (failure) { setError(apiErrorText(failure, t)); } finally { setBusy(false); }
  };

  if (step === "done") {
    return (
      <AuthCard title={t("publicAuth.resetDone")} subtitle={t("publicAuth.resetDoneBody")}>
        <Button asChild className="h-12 w-full"><Link href={`/${params.locale}/login`}>{t("auth.signIn")}</Link></Button>
      </AuthCard>
    );
  }
  return (
    <AuthCard title={t("publicAuth.forgotTitle")} subtitle={step === "email" ? t("publicAuth.forgotBody") : t("publicAuth.codeSent")}>
      {step === "email" ? (
        <form className="space-y-5" onSubmit={requestCode} noValidate>
          <div className="space-y-2">
            <Label htmlFor="forgot-email">{t("publicAuth.email")}</Label>
            <div className="relative">
              <MailCheck className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="forgot-email" type="email" autoComplete="email" dir="ltr" className="h-12 ps-10 text-start" value={email} maxLength={254} onChange={(event) => setEmail(event.target.value)} />
            </div>
          </div>
          {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
          <Button type="submit" className="h-12 w-full rounded-xl brand-gradient text-white" isLoading={busy} disabled={busy}>{t("publicAuth.sendCode")}</Button>
        </form>
      ) : (
        <form className="space-y-5" onSubmit={confirmReset} noValidate>
          <div className="space-y-2">
            <Label htmlFor="forgot-code">{t("publicAuth.code")}</Label>
            <Input id="forgot-code" inputMode="numeric" autoComplete="one-time-code" dir="ltr" className="h-12 text-center tracking-[0.5em]" value={code} maxLength={6} onChange={(event) => setCode(event.target.value.replace(/\D/gu, ""))} />
          </div>
          <PasswordField id="forgot-password" label={t("publicAuth.newPassword")} value={password} onChange={setPassword} autoComplete="new-password" />
          <PasswordField id="forgot-confirm" label={t("publicAuth.confirmPassword")} value={confirm} onChange={setConfirm} autoComplete="new-password" />
          {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
          <Button type="submit" className="h-12 w-full rounded-xl brand-gradient text-white" isLoading={busy} disabled={busy}>{t("publicAuth.setPassword")}</Button>
        </form>
      )}
      <p className="mt-5 text-center text-sm"><Link className="text-primary underline-offset-4 hover:underline" href={`/${params.locale}/login`}>{t("publicAuth.backToLogin")}</Link></p>
    </AuthCard>
  );
}

/** Signed-in password change (settings, and the screen shown to accounts created with a temporary password). */
export function ChangePasswordForm({ forced = false }: { forced?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const problem = !current ? t("common.required") : passwordProblem(password, confirm, t);
    if (problem) { setError(problem); return; }
    setBusy(true); setError(null);
    try {
      await bffFetch("/api/backend/api/v1/auth/change-password/", { method: "POST", body: { old_password: current, new_password: password, new_password_confirm: confirm } });
      toast.success(t("publicAuth.changedSignIn"));
      // The backend ends every session after a password change: sign in again with the new one.
      router.replace(`/${params.locale}/login`);
      router.refresh();
    } catch (failure) { setError(apiErrorText(failure, t)); } finally { setBusy(false); }
  };

  return (
    <form className="space-y-4" onSubmit={submit} noValidate>
      {forced ? <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">{t("publicAuth.mustChange")}</p> : null}
      <PasswordField id="current-password" label={t("publicAuth.currentPassword")} value={current} onChange={setCurrent} autoComplete="current-password" />
      <PasswordField id="change-password" label={t("publicAuth.newPassword")} value={password} onChange={setPassword} autoComplete="new-password" />
      <PasswordField id="change-confirm" label={t("publicAuth.confirmPassword")} value={confirm} onChange={setConfirm} autoComplete="new-password" />
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      <Button type="submit" isLoading={busy} disabled={busy}>{t("publicAuth.changePassword")}</Button>
    </form>
  );
}
