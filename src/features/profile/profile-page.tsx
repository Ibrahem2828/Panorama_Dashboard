"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { CapabilityGate } from "@/components/feedback/capability-gate";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { Ltr } from "@/components/shared/ltr";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ChangePasswordForm } from "@/features/auth/public-auth";
import { FULL_NAME_MAX, JOB_TITLE_MAX, profileChanges, validateProfile, type ProfileForm } from "@/features/profile/rules";
import { useSession } from "@/features/session";
import { useI18n } from "@/i18n/provider";
import { apiFetch, unwrap } from "@/lib/api/browser-client";
import { apiErrorText } from "@/lib/api/error-message";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import type { ApiEnvelope } from "@/types/api";

interface Me { id: number; full_name: string; job_title?: string; email: string; phone_number?: string | null; role: string }

const ME_KEY = ["auth-me"] as const;

function ReadOnlyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="rounded-xl border p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 truncate text-sm font-bold">{children}</dd></div>;
}

/** The signed-in person's own page: name, job title, password. Open to every dashboard user (no special capability). */
export function ProfilePage() {
  const { t } = useI18n();
  const session = useSession();
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ME_KEY,
    queryFn: async () => unwrap(await apiFetch<ApiEnvelope<Me>>("/api/v1/auth/me/")),
  });
  const [edits, setEdits] = useState<Partial<ProfileForm>>({});
  const [touched, setTouched] = useState(false);
  const saved: ProfileForm = { full_name: me.data?.full_name ?? "", job_title: me.data?.job_title ?? "" };
  // Until the person types, the form shows what is saved.
  const form: ProfileForm = { ...saved, ...edits };
  const setForm = (next: ProfileForm) => setEdits(next);

  const save = useMutation({
    mutationFn: async (body: Partial<ProfileForm>) => unwrap(await apiFetch<ApiEnvelope<Me>>("/api/v1/auth/me/", { method: "PATCH", body })),
    onSuccess: async (data) => {
      queryClient.setQueryData(ME_KEY, data);
      // The topbar, sidebar and overview greeting read the name from the session.
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      toast.success(t("profile.saved"));
      setTouched(false);
      setEdits({});
    },
    onError: (error) => toast.error(apiErrorText(error, t)),
  });

  const errors = validateProfile(form);
  const changes = profileChanges(saved, form);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length || !Object.keys(changes).length) return;
    save.mutate(changes);
  };
  const nameError = touched && errors.full_name ? (errors.full_name === "required" ? t("common.required") : t("validation.maxLength", { n: FULL_NAME_MAX })) : null;
  const titleError = touched && errors.job_title ? t("validation.maxLength", { n: JOB_TITLE_MAX }) : null;

  return (
    <CapabilityGate capability={CAPABILITIES.dashboard}>
      <div className="space-y-6">
        <PageHeader title={t("profile.title")} description={t("profile.subtitle")} eyebrow={t("eyebrow.personal")} />
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>{t("profile.details")}</CardTitle><CardDescription>{t("profile.detailsHint")}</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              {me.isPending ? <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-10" /></div> : me.isError ? <ErrorPanel error={me.error} retry={() => me.refetch()} /> : (
                <>
                  <form className="space-y-4" onSubmit={submit} noValidate>
                    <div className="space-y-2">
                      <Label htmlFor="profile-name">{t("field.full_name")}</Label>
                      <Input id="profile-name" value={form.full_name} maxLength={FULL_NAME_MAX + 10} autoComplete="name" onChange={(event) => setForm({ ...form, full_name: event.target.value })} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? "profile-name-error" : undefined} />
                      {nameError ? <p id="profile-name-error" role="alert" className="text-xs text-destructive">{nameError}</p> : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-job">{t("field.job_title")}</Label>
                      <Input id="profile-job" value={form.job_title} maxLength={JOB_TITLE_MAX + 10} autoComplete="organization-title" onChange={(event) => setForm({ ...form, job_title: event.target.value })} placeholder={t("profile.jobPlaceholder")} aria-invalid={Boolean(titleError)} aria-describedby="profile-job-hint" />
                      <p id="profile-job-hint" className="text-xs text-muted-foreground">{t("profile.jobHint")}</p>
                      {titleError ? <p role="alert" className="text-xs text-destructive">{titleError}</p> : null}
                    </div>
                    <Button type="submit" isLoading={save.isPending} disabled={save.isPending || !Object.keys(changes).length}>{t("common.save")}</Button>
                  </form>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <ReadOnlyRow label={t("field.email")}><Ltr as="span">{me.data.email}</Ltr></ReadOnlyRow>
                    <ReadOnlyRow label={t("profile.phone")}>{me.data.phone_number ? <Ltr as="span">{me.data.phone_number}</Ltr> : "—"}</ReadOnlyRow>
                    <ReadOnlyRow label={t("field.role")}>{t(`roles.${session.user.role}` as "roles.admin")}</ReadOnlyRow>
                  </dl>
                  <p className="text-xs text-muted-foreground">{t("profile.readOnlyNote")}</p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t("publicAuth.changePassword")}</CardTitle><CardDescription>{t("publicAuth.changeSubtitle")}</CardDescription></CardHeader>
            <CardContent className="max-w-md"><ChangePasswordForm /></CardContent>
          </Card>
        </div>
      </div>
    </CapabilityGate>
  );
}
