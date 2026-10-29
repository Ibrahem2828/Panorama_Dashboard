"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Ban, Check, LockKeyholeOpen, Mail, Phone, ShieldOff, UserCheck, UserMinus, UserX, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { AccessDenied } from "@/components/feedback/access-denied";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { Ltr } from "@/components/shared/ltr";
import { Money } from "@/components/shared/money";
import { StatusPill } from "@/components/shared/status-pill";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SenderAvatar } from "@/features/chat/chat-bubbles";
import { availableMembershipActions, membershipRequest, type MembershipAction } from "@/features/groups/group-rules";
import { useCan, useSession } from "@/features/session";
import { canActivateUser, canDeactivateUser, canUnlockLogin } from "@/features/users/user-rules";
import {
  isTruncated, parseProfileTab, profileTabHref, refName, tabCount, type ProfileGroup, type ProfileTab, type StudentDetail,
} from "@/features/users/user-profile-rules";
import type { MessageKey } from "@/i18n/messages";
import { useIdempotencyKey, useMutationError } from "@/hooks/use-idempotency-key";
import { useI18n } from "@/i18n/provider";
import { localizePath } from "@/i18n/routing";
import { apiFetch, unwrap } from "@/lib/api/browser-client";
import { payloadSignature } from "@/lib/api/idempotency";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { formatDate } from "@/lib/utils";
import type { ApiEnvelope } from "@/types/api";

type Count = keyof NonNullable<StudentDetail["counts"]>;
const TABS: { key: ProfileTab; label: MessageKey; count?: Count }[] = [
  { key: "overview", label: "userProfile.tab.overview" },
  { key: "groups", label: "userProfile.tab.groups", count: "groups" },
  { key: "enrollments", label: "userProfile.tab.enrollments", count: "enrollments" },
  { key: "files", label: "userProfile.tab.files", count: "files" },
  { key: "orders", label: "userProfile.tab.orders", count: "print_orders" },
  { key: "tickets", label: "userProfile.tab.tickets", count: "support_tickets" },
  { key: "verification", label: "userProfile.tab.verification", count: "verification_history" },
];

type UserAction = "activate" | "deactivate" | "unlock";

/** Profile of one student or staff account: header with quick actions and deep-linkable tabs (`?tab=`). */
export function UserProfilePage({ userId }: { userId: number }) {
  const { t, locale } = useI18n();
  const canUsers = useCan(CAPABILITIES.users);
  const canVerify = useCan(CAPABILITIES.verification);
  const router = useRouter();
  const pathname = usePathname();
  const tab = parseProfileTab(useSearchParams()?.get("tab"));

  const detail = useQuery({
    queryKey: ["user-profile", userId],
    enabled: canUsers || canVerify,
    queryFn: () => unwrap(apiFetch<ApiEnvelope<StudentDetail> | StudentDetail>(`/api/v1/dashboard/users/${userId}/student-detail/`)) as Promise<StudentDetail>,
  });
  // Role and activation state come from the user record (needs users.manage); the page degrades without it.
  const record = useQuery({
    queryKey: ["user-profile-record", userId],
    enabled: canUsers,
    retry: false,
    queryFn: () => unwrap(apiFetch<ApiEnvelope<{ role: string; is_active: boolean }>>(`/api/v1/dashboard/users/${userId}/`)),
  });

  if (!canUsers && !canVerify) return <AccessDenied />;
  if (detail.isPending) return <div className="space-y-4" aria-busy="true"><Skeleton className="h-28 w-full rounded-2xl" /><Skeleton className="h-72 w-full rounded-2xl" /></div>;
  if (detail.isError) return <ErrorPanel error={detail.error} retry={() => void detail.refetch()} />;
  const data = detail.data;
  const role = record.data?.role ?? data.user.role ?? "";
  const active = record.data?.is_active ?? data.user.is_active;
  const select = (next: string) => router.replace(profileTabHref(pathname ?? "", parseProfileTab(next)), { scroll: false });

  return (
    <div className="space-y-5">
      <Link href={localizePath(locale, "/dashboard/users")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />{t("userProfile.backToUsers")}
      </Link>
      <ProfileHeader data={data} role={role} active={active} userId={userId} />
      <Tabs value={tab} onValueChange={select}>
        <TabsList className="h-auto max-w-full flex-wrap justify-start gap-1">
          {TABS.map(({ key, label, count }) => (
            <TabsTrigger key={key} value={key}>
              {t(label)}
              {count ? <span className="ms-1.5 rounded-full bg-background/70 px-1.5 text-xs tabular-nums">{tabCount(data, count)}</span> : null}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview"><Overview data={data} role={role} active={active} /></TabsContent>
        <TabsContent value="groups"><GroupsTab data={data} userId={userId} /></TabsContent>
        <TabsContent value="enrollments"><EnrollmentsTab data={data} /></TabsContent>
        <TabsContent value="files"><FilesTab data={data} /></TabsContent>
        <TabsContent value="orders"><OrdersTab data={data} /></TabsContent>
        <TabsContent value="tickets"><TicketsTab data={data} /></TabsContent>
        <TabsContent value="verification"><VerificationTab data={data} /></TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileHeader({ data, role, active, userId }: { data: StudentDetail; role: string; active: boolean; userId: number }) {
  const { t, tOr, locale } = useI18n();
  const { user: actor } = useSession();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<UserAction | null>(null);
  const [reason, setReason] = useState("");
  const key = useIdempotencyKey();
  const onError = useMutationError(key);
  const target = { id: userId, role, is_active: active };
  const me = { id: actor.id, role: actor.role };
  const known = role !== "";
  const allowed: UserAction[] = !known ? [] : [
    ...(canDeactivateUser(me, target) ? ["deactivate" as const] : []),
    ...(canActivateUser(me, target) ? ["activate" as const] : []),
    ...(canUnlockLogin(me, target) ? ["unlock" as const] : []),
  ];
  const run = useMutation({
    mutationFn: async (kind: UserAction) => {
      const path = `/api/v1/dashboard/users/${userId}/${kind === "unlock" ? "unlock-login" : kind}/`;
      const body = kind === "deactivate" ? { reason: reason.trim() } : kind === "unlock" ? {} : undefined;
      return apiFetch(path, { method: "POST", body, idempotencyKey: key.get(payloadSignature(kind, userId, body)) });
    },
    onSuccess: async () => {
      key.reset(); toast.success(t("common.success")); setAction(null); setReason("");
      await queryClient.invalidateQueries({ queryKey: ["user-profile", userId] });
      await queryClient.invalidateQueries({ queryKey: ["user-profile-record", userId] });
    },
    onError: (error) => { onError(error); setAction(null); },
  });
  const name = data.user.full_name || data.user.email || `#${userId}`;
  const needsReason = action === "deactivate";
  const icon = { activate: <UserCheck />, deactivate: <UserX />, unlock: <LockKeyholeOpen /> } as const;

  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <SenderAvatar name={name} staff={role !== "" && role !== "student" && role !== "normal_user"} className="size-16 text-xl" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <h1 className="gold-rule truncate text-2xl font-black">{name}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {data.user.job_title ? <span className="font-semibold text-foreground">{data.user.job_title}</span> : null}
          {role ? <span>{tOr(`roles.${role}`, tOr(`enum.${role}`, role))}</span> : null}
          <StatusPill value={active ? "active" : "inactive"} label={active ? t("common.active") : t("common.inactive")} />
          {data.profile?.verification_status ? <StatusPill value={data.profile.verification_status} /> : null}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {data.user.email ? <span className="inline-flex items-center gap-1"><Mail className="size-4" aria-hidden /><Ltr>{data.user.email}</Ltr></span> : null}
          {data.user.phone_number ? <span className="inline-flex items-center gap-1"><Phone className="size-4" aria-hidden /><Ltr>{data.user.phone_number}</Ltr></span> : null}
          <span>{t("userProfile.lastLogin")}: {formatDate(data.user.last_login, locale)}</span>
        </div>
      </div>
      {allowed.length > 0 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("userProfile.quickActions")}>
          {allowed.map((kind) => (
            <Button key={kind} type="button" variant={kind === "deactivate" ? "destructive" : "outline"} onClick={() => { setReason(""); setAction(kind); }}>
              {icon[kind]}{t(kind === "unlock" ? "users.unlockLogin" : kind === "activate" ? "users.activate" : "users.deactivate")}
            </Button>
          ))}
        </div>
      ) : null}
      <AlertDialog open={action !== null} onOpenChange={(open) => { if (!open && !run.isPending) setAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{action ? t(action === "unlock" ? "users.unlockLoginTitle" : action === "activate" ? "users.activateTitle" : "users.deactivateTitle") : ""}</AlertDialogTitle>
            <AlertDialogDescription>{action ? t(action === "unlock" ? "users.unlockLoginDescription" : action === "activate" ? "users.activateDescription" : "users.deactivateDescription", { name }) : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          {needsReason ? <Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={255} aria-label={t("users.deactivateReason")} placeholder={t("users.deactivateReason")} /> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={run.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={run.isPending || (needsReason && reason.trim().length < 3)} onClick={(event) => { event.preventDefault(); if (action) run.mutate(action); }}>{t("form.confirmAction")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border p-3">
      <dt className="text-xs font-bold text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium">{children || "—"}</dd>
    </div>
  );
}

function Overview({ data, role, active }: { data: StudentDetail; role: string; active: boolean }) {
  const { t, tOr, locale } = useI18n();
  const profile = data.profile;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section aria-labelledby="profile-academic">
        <h2 id="profile-academic" className="mb-2 text-sm font-bold">{t("userProfile.academic")}</h2>
        {profile ? (
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label={t("verifications.field.university")}>{refName(profile.university)}</Field>
            <Field label={t("verifications.field.faculty")}>{refName(profile.faculty)}</Field>
            <Field label={t("verifications.field.major")}>{refName(profile.major)}</Field>
            <Field label={t("verifications.field.academicYear")}>{refName(profile.academic_year)}</Field>
            <Field label={t("verifications.field.semester")}>{refName(profile.semester)}</Field>
            <Field label={t("verifications.field.studentNumber")}>{profile.student_number ? <Ltr>{profile.student_number}</Ltr> : null}</Field>
            <Field label={t("userProfile.verificationStatus")}>{profile.verification_status ? <StatusPill value={profile.verification_status} /> : null}</Field>
            {profile.needs_term_confirmation ? <Field label={t("userProfile.termConfirmation")}>{t("userProfile.termConfirmationPending")}</Field> : null}
          </dl>
        ) : <p className="rounded-xl border p-4 text-sm text-muted-foreground">{t("userProfile.noProfile")}</p>}
      </section>
      <section aria-labelledby="profile-account">
        <h2 id="profile-account" className="mb-2 text-sm font-bold">{t("userProfile.account")}</h2>
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field label={t("users.email")}>{data.user.email ? <Ltr>{data.user.email}</Ltr> : null}</Field>
          <Field label={t("users.phone")}>{data.user.phone_number ? <Ltr>{data.user.phone_number}</Ltr> : null}</Field>
          <Field label={t("userProfile.jobTitle")}>{data.user.job_title}</Field>
          <Field label={t("userProfile.role")}>{role ? tOr(`roles.${role}`, tOr(`enum.${role}`, role)) : ""}</Field>
          <Field label={t("common.status")}><StatusPill value={active ? "active" : "inactive"} label={active ? t("common.active") : t("common.inactive")} /></Field>
          <Field label={t("userProfile.lastLogin")}>{formatDate(data.user.last_login, locale)}</Field>
          <Field label={t("common.createdAt")}>{formatDate(data.user.created_at, locale)}</Field>
        </dl>
      </section>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">{children}</p>;
}

function Truncated({ data, k }: { data: StudentDetail; k: Count }) {
  const { t } = useI18n();
  return isTruncated(data, k) ? <p className="mt-2 text-xs text-muted-foreground">{t("userProfile.truncated", { shown: data[k].length, total: tabCount(data, k) })}</p> : null;
}

function GroupsTab({ data, userId }: { data: StudentDetail; userId: number }) {
  const { t, tOr, locale } = useI18n();
  const canManage = useCan(CAPABILITIES.groups);
  const queryClient = useQueryClient();
  const key = useIdempotencyKey();
  const onError = useMutationError(key);
  const [pending, setPending] = useState<{ action: MembershipAction; row: ProfileGroup } | null>(null);
  const run = useMutation({
    mutationFn: ({ action, row }: { action: MembershipAction; row: ProfileGroup }) => {
      const request = membershipRequest(action, row.membership_id);
      return apiFetch(request.path, { method: request.method, body: request.body, idempotencyKey: key.get(payloadSignature(action, row.membership_id)) });
    },
    onSuccess: async () => { key.reset(); toast.success(t("common.success")); setPending(null); await queryClient.invalidateQueries({ queryKey: ["user-profile", userId] }); },
    onError: (error) => { onError(error); setPending(null); },
  });
  if (data.groups.length === 0) return <Empty>{t("userProfile.noGroups")}</Empty>;
  const icons: Partial<Record<MembershipAction, ReactNode>> = { approve: <Check />, reject: <X />, remove: <UserMinus />, block: <Ban />, unblock: <ShieldOff /> };
  const confirmKey = pending ? (pending.action === "remove" ? "remove" : pending.action) : "reject";
  return (
    <>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow className="bg-muted/55"><TableHead>{t("userProfile.group")}</TableHead><TableHead>{t("groups.members.role")}</TableHead><TableHead>{t("common.status")}</TableHead><TableHead>{t("userProfile.joinedAt")}</TableHead><TableHead><span className="sr-only">{t("common.actions")}</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {data.groups.map((row) => {
              const actions = canManage ? availableMembershipActions(row.status).filter((action) => action !== "role") : [];
              const subject = refName(row.subject);
              return (
                <TableRow key={row.membership_id}>
                  <TableCell className="font-medium"><Link className="hover:underline" href={`${localizePath(locale, "/dashboard/groups")}?highlight=${row.group_id}`}>{row.group_name}</Link>{subject ? <span className="ms-2 text-xs text-muted-foreground">{subject}</span> : null}</TableCell>
                  <TableCell>{tOr(`enum.${row.role}`, row.role)}</TableCell>
                  <TableCell><StatusPill value={row.status} label={tOr(`groups.status.${row.status}`, row.status)} /></TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(row.joined_at, locale)}</TableCell>
                  <TableCell><div className="flex flex-wrap justify-end gap-2">{actions.map((action) => (
                    <Button key={action} size="sm" variant={action === "block" ? "destructive" : "outline"} disabled={run.isPending} onClick={() => setPending({ action, row })}>{icons[action]}{t(`groups.action.${action}` as "groups.action.remove")}</Button>
                  ))}</div></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <Truncated data={data} k="groups" />
      <AlertDialog open={pending !== null} onOpenChange={(open) => { if (!open && !run.isPending) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(`groups.confirm.${confirmKey}Title` as "groups.confirm.rejectTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t(`groups.confirm.${confirmKey}Description` as "groups.confirm.rejectDescription", { name: data.user.full_name, group: pending?.row.group_name ?? "", role: "" })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={run.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={run.isPending} className={pending?.action === "block" || pending?.action === "remove" ? "bg-destructive text-destructive-foreground" : undefined} onClick={(event) => { event.preventDefault(); if (pending) run.mutate(pending); }}>{t("form.confirmAction")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SimpleTable({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table><TableHeader><TableRow className="bg-muted/55">{head.map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{children}</TableBody></Table>
    </div>
  );
}

function EnrollmentsTab({ data }: { data: StudentDetail }) {
  const { t, locale } = useI18n();
  if (data.enrollments.length === 0) return <Empty>{t("userProfile.noEnrollments")}</Empty>;
  return (
    <>
      <SimpleTable head={[t("userProfile.requestNumber"), t("common.status"), t("userProfile.subjects"), t("common.createdAt")]}>
        {data.enrollments.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="tabular-nums">#{row.id}</TableCell>
            <TableCell><StatusPill value={row.status} /></TableCell>
            <TableCell><ul className="space-y-1">{row.items.map((item, index) => <li key={index} className="flex items-center gap-2 text-sm">{refName(item.subject)}<StatusPill value={item.status} /></li>)}</ul></TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(row.created_at, locale)}</TableCell>
          </TableRow>
        ))}
      </SimpleTable>
      <Truncated data={data} k="enrollments" />
    </>
  );
}

function FilesTab({ data }: { data: StudentDetail }) {
  const { t, locale } = useI18n();
  if (data.files.length === 0) return <Empty>{t("userProfile.noFiles")}</Empty>;
  return (
    <>
      <SimpleTable head={[t("userProfile.fileTitle"), t("common.status"), t("common.createdAt")]}>
        {data.files.map((row) => (
          <TableRow key={row.id}><TableCell className="font-medium" dir="auto">{row.title}</TableCell><TableCell><StatusPill value={row.status} /></TableCell><TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(row.created_at, locale)}</TableCell></TableRow>
        ))}
      </SimpleTable>
      <Truncated data={data} k="files" />
    </>
  );
}

function OrdersTab({ data }: { data: StudentDetail }) {
  const { t, locale } = useI18n();
  if (data.print_orders.length === 0) return <Empty>{t("userProfile.noOrders")}</Empty>;
  return (
    <>
      <SimpleTable head={[t("userProfile.requestNumber"), t("common.status"), t("userProfile.total"), t("common.createdAt")]}>
        {data.print_orders.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="tabular-nums">#{row.id}</TableCell>
            <TableCell><StatusPill value={row.status} /></TableCell>
            <TableCell>{row.total === null || row.total === undefined ? "—" : <Money value={row.total} currency={row.currency ?? "SYP"} />}</TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(row.created_at, locale)}</TableCell>
          </TableRow>
        ))}
      </SimpleTable>
      <Truncated data={data} k="print_orders" />
    </>
  );
}

function TicketsTab({ data }: { data: StudentDetail }) {
  const { t, locale } = useI18n();
  if (data.support_tickets.length === 0) return <Empty>{t("userProfile.noTickets")}</Empty>;
  return (
    <>
      <SimpleTable head={[t("userProfile.requestNumber"), t("userProfile.ticketSubject"), t("common.status"), t("common.createdAt")]}>
        {data.support_tickets.map((row) => (
          <TableRow key={row.id}><TableCell className="tabular-nums">#{row.id}</TableCell><TableCell className="font-medium" dir="auto">{row.subject}</TableCell><TableCell><StatusPill value={row.status} /></TableCell><TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(row.created_at, locale)}</TableCell></TableRow>
        ))}
      </SimpleTable>
      <Truncated data={data} k="support_tickets" />
    </>
  );
}

function VerificationTab({ data }: { data: StudentDetail }) {
  const { t, locale } = useI18n();
  if (data.verification_history.length === 0) return <Empty>{t("userProfile.noVerification")}</Empty>;
  return (
    <>
      <SimpleTable head={[t("common.status"), t("userProfile.submittedAt"), t("userProfile.reviewedAt"), t("userProfile.note")]}>
        {data.verification_history.map((row) => (
          <TableRow key={row.id}>
            <TableCell><StatusPill value={row.status} /></TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(row.created_at, locale)}</TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(row.reviewed_at, locale)}</TableCell>
            <TableCell className="max-w-md break-words" dir="auto">{row.note || "—"}</TableCell>
          </TableRow>
        ))}
      </SimpleTable>
      <Truncated data={data} k="verification_history" />
    </>
  );
}
