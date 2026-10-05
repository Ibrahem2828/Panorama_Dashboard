"use client";

import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin } from "@/features/session";
import { useI18n } from "@/i18n/provider";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const login = useLogin();
  const { t } = useI18n();
  const valid = identifier.trim().length >= 3 && password.length >= 8;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (valid) login.mutate({ identifier: identifier.trim(), password });
  };

  return (
    <form className="space-y-5" onSubmit={submit} noValidate>
      <div className="space-y-2">
        <Label htmlFor="identifier">{t("auth.identifier")}</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="identifier" autoComplete="username" className="h-12 ps-10" placeholder={t("auth.identifierPlaceholder")} disabled={login.isPending} value={identifier} onChange={(event) => setIdentifier(event.target.value)} maxLength={254} aria-invalid={touched && identifier.trim().length < 3} />
        </div>
        {touched && identifier.trim().length < 3 ? <p className="text-xs text-destructive">{t("common.required")}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("auth.password")}</Label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" className="h-12 px-10" placeholder={t("auth.passwordPlaceholder")} disabled={login.isPending} value={password} onChange={(event) => setPassword(event.target.value)} maxLength={512} aria-invalid={touched && password.length < 8} />
          <Button type="button" variant="ghost" size="icon" className="absolute end-1 top-1/2 -translate-y-1/2" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}>
            {showPassword ? <EyeOff /> : <Eye />}
          </Button>
        </div>
        {touched && password.length < 8 ? <p className="text-xs text-destructive">{t("auth.passwordMinimum")}</p> : null}
      </div>
      <Button type="submit" className="h-12 w-full rounded-xl brand-gradient text-white shadow-lg shadow-primary/15" isLoading={login.isPending} disabled={login.isPending}>
        {login.isPending ? t("auth.signingIn") : t("auth.signIn")}
      </Button>
      <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs leading-5 text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        <span>{t("auth.secureSession")}</span>
      </div>
    </form>
  );
}
