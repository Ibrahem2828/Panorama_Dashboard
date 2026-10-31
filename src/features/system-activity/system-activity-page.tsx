"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Eye, Gauge, History, KeyRound, ShieldAlert, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Pagination } from "@/components/data-grid/pagination";
import { CapabilityGate } from "@/components/feedback/capability-gate";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { FilterBar, FilterEmptyState } from "@/components/filters/filter-bar";
import { toQueryString } from "@/components/filters/filter-state";
import { useFilterState } from "@/components/filters/use-filter-state";
import { Ltr } from "@/components/shared/ltr";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelativeAge } from "@/features/printing/printers-rules";
import {
  KIND_LABEL_KEYS, activityFields, activitySchema, failedReasonOf, outcomeOf, userDisplayName,
  type ActivityRow, type ActivitySummary, type ActivityUserRollup,
} from "@/features/system-activity/rules";
import { ReasonBadge } from "@/features/system-activity/reason-badge";
import { UserLink } from "@/features/users/user-link";
import { useI18n } from "@/i18n/provider";
import { apiFetch, normalizeCollection, unwrap } from "@/lib/api/browser-client";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { cn, formatDate, formatNumber } from "@/lib/utils";

const BASE = "/api/v1/dashboard/system-activity/";
type Tab = "live" | "users";

function parseTab(value: string | null | undefined): Tab {
  return value === "users" ? "users" : "live";
}

function StatusBadge({ row }: { row: ActivityRow }) {
  const { t } = useI18n();
  const outcome = outcomeOf(row);
  const code = row.status_code;
  const label = code !== null ? String(code) : t(outcome === "error" ? "sysActivity.outcome.error" : "sysActivity.outcome.success");
  const tone = outcome === "error" ? (code !== null && code >= 500 ? "destructive" : "warning") : "success";
  return <Badge variant={tone} className="tabular-nums" data-testid="outcome-badge" title={t(outcome === "error" ? "sysActivity.outcome.error" : "sysActivity.outcome.success")}><Ltr as="span">{label}</Ltr></Badge>;
}

function RelativeTime({ value }: { value: string | null | undefined }) {
  const { locale } = useI18n();
  if (!value) return <span>—</span>;
  const absolute = formatDate(value, locale);
  return <time dateTime={value} title={absolute} className="whitespace-nowrap">{formatRelativeAge(value, locale) ?? absolute}</time>;
}

function Summary({ summary, loading }: { summary: ActivitySummary | undefined; loading: boolean }) {
  const { t, locale } = useI18n();
  const items = [
    { key: "total", icon: Activity, value: summary?.total, tone: "text-primary" },
    { key: "activeUsers", icon: Users, value: summary?.active_users, tone: "text-sky-600" },
    { key: "errors", icon: AlertTriangle, value: summary?.errors, tone: "text-amber-600" },
    { key: "failedLogins", icon: KeyRound, value: summary?.failed_logins, tone: "text-destructive" },
    { key: "denied", icon: ShieldAlert, value: summary?.by_kind?.denied, tone: "text-destructive" },
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="activity-summary">
      {items.map(({ key, icon: Icon, value, tone }) => (
        <Card key={key}>
          <CardContent className="flex items-center gap-3 p-4">
            <Icon className={cn("size-6 shrink-0", tone)} aria-hidden />
            <div className="min-w-0">
              <div className="text-2xl font-black tabular-nums" data-testid={`summary-${key}`}>{loading && value === undefined ? "…" : formatNumber(value ?? 0, locale)}</div>
              <div className="truncate text-xs text-muted-foreground">{t(`sysActivity.summary.${key}` as "sysActivity.summary.total")}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function UserCell({ row }: { row: ActivityRow }) {
  const { t, enumLabel } = useI18n();
  if (!row.user) {
    return <span className="text-muted-foreground">{row.user_label || t("sysActivity.anonymous")}</span>;
  }
  const name = userDisplayName(row.user, row.user_label);
  return (
    <div className="min-w-0">
      <UserLink userId={row.user.id} name={name} className="font-semibold" />
      <div className="truncate text-xs text-muted-foreground">{[row.user.job_title, enumLabel(row.user.role)].filter(Boolean).join(" · ")}</div>
    </div>
  );
}

function ActionCell({ row }: { row: ActivityRow }) {
  const { t } = useI18n();
  const reason = failedReasonOf(row);
  const masked = row.kind === "login_failed" && typeof row.extra?.identifier_masked === "string" ? row.extra.identifier_masked : null;
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-medium">{row.action_label || t(KIND_LABEL_KEYS[row.kind] ?? "sysActivity.kind.request")}</span>
        {row.kind === "login_failed" ? <ReasonBadge reason={reason} /> : null}
        {row.kind === "denied" ? <Badge variant="destructive">{t("sysActivity.kind.denied")}</Badge> : null}
      </div>
      {masked ? <Ltr as="div" className="text-xs text-muted-foreground">{masked}</Ltr> : null}
      {row.route ? <Ltr as="div" className="max-w-[28rem] truncate font-mono text-xs text-muted-foreground" title={`${row.method} ${row.route}`}>{row.method} {row.route}</Ltr> : null}
    </div>
  );
}

function DetailDialog({ row, onClose }: { row: ActivityRow | null; onClose: () => void }) {
  const { t, locale } = useI18n();
  const extra = row?.extra && Object.keys(row.extra).length ? JSON.stringify(row.extra, null, 2) : null;
  const reason = row ? failedReasonOf(row) : undefined;
  const fields: [string, React.ReactNode][] = row ? [
    [t("sysActivity.col.time"), formatDate(row.created_at, locale)],
    [t("sysActivity.col.user"), row.user ? <UserLink key="u" userId={row.user.id} name={userDisplayName(row.user, row.user_label)} /> : row.user_label || t("sysActivity.anonymous")],
    [t("sysActivity.filter.kind"), t(KIND_LABEL_KEYS[row.kind] ?? "sysActivity.kind.request")],
    [t("sysActivity.col.action"), row.action_label || "—"],
    [t("sysActivity.filter.route"), row.route ? <Ltr key="r" as="span" className="font-mono">{row.method} {row.route}</Ltr> : "—"],
    [t("sysActivity.detail.status"), row.status_code !== null ? <Ltr key="s" as="span">{row.status_code}</Ltr> : "—"],
    [t("sysActivity.detail.object"), row.object_type ? <Ltr key="o" as="span">{row.object_type}{row.object_id ? ` #${row.object_id}` : ""}</Ltr> : "—"],
    [t("sysActivity.col.ip"), row.ip ? <Ltr key="i" as="span">{row.ip}</Ltr> : "—"],
    [t("sysActivity.col.duration"), row.duration_ms !== null ? <Ltr key="d" as="span">{formatNumber(row.duration_ms, locale)} ms</Ltr> : "—"],
    [t("sysActivity.detail.userAgent"), row.user_agent ? <Ltr key="a" as="span" className="break-all">{row.user_agent}</Ltr> : "—"],
  ] : [];
  return (
    <Dialog open={Boolean(row)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("sysActivity.detail.title")}</DialogTitle>
          <DialogDescription>{row?.action_label}</DialogDescription>
        </DialogHeader>
        {row ? (
          <div className="space-y-4 text-sm">
            {row.kind === "login_failed" ? <div className="flex items-center gap-2"><span className="font-semibold">{t("sysActivity.detail.reason")}</span><ReasonBadge reason={reason} /></div> : null}
            <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[10rem_1fr]">
              {fields.map(([label, value]) => (
                <div key={label} className="contents"><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 break-words">{value}</dd></div>
              ))}
            </dl>
            {extra ? (
              <div>
                <h3 className="mb-1 font-semibold">{t("sysActivity.detail.extra")}</h3>
                <Ltr as="pre" className="max-h-64 overflow-auto rounded-lg border bg-muted/40 p-3 text-xs">{extra}</Ltr>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function useUserOptions(enabled: boolean) {
  const query = useQuery({
    queryKey: ["system-activity-user-options"],
    queryFn: async () => normalizeCollection<ActivityUserRollup>(await apiFetch(`${BASE}users/?page_size=100&ordering=-last_activity_at`)),
    enabled,
    staleTime: 5 * 60_000,
    meta: { autoRefresh: false },
  });
  return useMemo(() => (query.data?.results ?? []).map((item) => ({ value: String(item.user.id), label: userDisplayName(item.user, `#${item.user.id}`) })), [query.data]);
}

function LiveFeed() {
  const { t, locale, enumLabel } = useI18n();
  const userOptions = useUserOptions(true);
  const structure = useMemo(() => activitySchema(activityFields({ t, roleLabel: (role) => role, userOptions: [] })), [t]);
  const state = useFilterState(structure);
  const fields = useMemo(() => activityFields({ t, roleLabel: enumLabel, userOptions, selectedUser: state.values.user }), [t, enumLabel, userOptions, state.values.user]);
  const [selected, setSelected] = useState<ActivityRow | null>(null);

  const params = state.requestParams;
  const list = useQuery({
    queryKey: ["system-activity", params, state.page, state.pageSize],
    queryFn: async () => normalizeCollection<ActivityRow>(await apiFetch(`${BASE}?${toQueryString(params, { ordering: "-created_at", page: state.page, page_size: state.pageSize })}`)),
    placeholderData: keepPreviousData,
  });
  const summary = useQuery({
    queryKey: ["system-activity-summary", params],
    queryFn: async () => unwrap(apiFetch<ActivitySummary>(`${BASE}summary/?${toQueryString(params)}`)),
    placeholderData: keepPreviousData,
  });
  const rows = list.data?.results ?? [];

  return (
    <div className="space-y-4">
      <Summary summary={summary.data} loading={summary.isPending} />
      <FilterBar state={state} fields={fields} searchPlaceholder={t("sysActivity.searchPlaceholder")} resultCount={list.data?.count ?? null} loading={list.isFetching && !list.isPending} />
      {list.isPending ? (
        <div className="space-y-3" aria-busy="true"><Skeleton className="h-80 rounded-xl" /></div>
      ) : list.isError && !list.data ? (
        <ErrorPanel error={list.error} retry={() => void list.refetch()} />
      ) : rows.length === 0 ? (
        <FilterEmptyState state={state} message={t("sysActivity.empty")} />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/55">
                    {(["time", "user", "action", "outcome", "ip", "duration"] as const).map((key) => (
                      <TableHead key={key} className="whitespace-nowrap font-bold">{t(`sysActivity.col.${key}` as "sysActivity.col.time")}</TableHead>
                    ))}
                    <TableHead className="w-10"><span className="sr-only">{t("common.actions")}</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} data-kind={row.kind} className={cn(row.kind === "login_failed" && "bg-red-500/5", row.kind === "denied" && "bg-amber-500/5")}>
                      <TableCell className="align-top text-sm"><RelativeTime value={row.created_at} /></TableCell>
                      <TableCell className="align-top"><UserCell row={row} /></TableCell>
                      <TableCell className="align-top"><ActionCell row={row} /></TableCell>
                      <TableCell className="align-top"><StatusBadge row={row} /></TableCell>
                      <TableCell className="align-top">{row.ip ? <Ltr as="span" className="font-mono text-xs">{row.ip}</Ltr> : "—"}</TableCell>
                      <TableCell className="align-top text-xs tabular-nums text-muted-foreground">{row.duration_ms !== null ? <Ltr as="span">{formatNumber(row.duration_ms, locale)} ms</Ltr> : "—"}</TableCell>
                      <TableCell className="align-top">
                        <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setSelected(row)} aria-label={`${t("sysActivity.detail.open")}: ${row.action_label}`} title={t("sysActivity.detail.open")}><Eye /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <Pagination page={state.page} pageSize={state.pageSize} count={list.data?.count ?? 0} onPage={state.setPage} onPageSize={state.setPageSize} />
        </>
      )}
      <DetailDialog row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

const USER_SORTS = ["-last_activity_at", "-requests_24h", "-failed_logins_24h", "-requests_7d"] as const;

function UsersRollup({ onOpenFeed }: { onOpenFeed: (userId: number) => void }) {
  const { t, locale, enumLabel } = useI18n();
  const structure = useMemo(() => ({
    searchParam: "search", sortParam: "ordering", defaultSort: "-last_activity_at",
    fields: [{ kind: "select" as const, key: "role", label: t("sysActivity.filter.role"), options: ["it_support", "admin", "print_staff", "support_staff", "content_manager", "student", "normal_user"].map((role) => ({ value: role, label: enumLabel(role) })), placement: "primary" as const }],
  }), [t, enumLabel]);
  const state = useFilterState(structure);
  const sortOptions = useMemo(() => USER_SORTS.map((value) => ({ value, label: t(`sysActivity.sort.${value.slice(1)}` as "sysActivity.sort.last_activity_at") })), [t]);
  const params = state.requestParams;
  const list = useQuery({
    queryKey: ["system-activity-users", params, state.page, state.pageSize],
    queryFn: async () => normalizeCollection<ActivityUserRollup>(await apiFetch(`${BASE}users/?${toQueryString(params, { page: state.page, page_size: state.pageSize })}`)),
    placeholderData: keepPreviousData,
  });
  const rows = list.data?.results ?? [];
  return (
    <div className="space-y-4">
      <FilterBar state={state} sortOptions={sortOptions} searchPlaceholder={t("sysActivity.users.searchPlaceholder")} resultCount={list.data?.count ?? null} loading={list.isFetching && !list.isPending} />
      {list.isPending ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy="true"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-40 rounded-xl" /></div>
      ) : list.isError && !list.data ? (
        <ErrorPanel error={list.error} retry={() => void list.refetch()} />
      ) : rows.length === 0 ? (
        <FilterEmptyState state={state} message={t("sysActivity.users.empty")} />
      ) : (
        <>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="user-rollup">
            {rows.map((item) => (
              <li key={item.user.id}>
                <Card className={cn("h-full", item.failed_logins_24h > 0 && "border-red-500/40")}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <UserLink userId={item.user.id} name={userDisplayName(item.user, `#${item.user.id}`)} className="font-bold" />
                        <div className="truncate text-xs text-muted-foreground">{[item.user.job_title, enumLabel(item.user.role)].filter(Boolean).join(" · ")}</div>
                      </div>
                      {item.failed_logins_24h > 0 ? <Badge variant="destructive" className="shrink-0" data-testid="failed-24h">{t("sysActivity.users.failed24h", { count: formatNumber(item.failed_logins_24h, locale) })}</Badge> : null}
                    </div>
                    <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg border p-2"><dt className="text-muted-foreground">{t("sysActivity.users.last")}</dt><dd className="font-semibold"><RelativeTime value={item.last_activity_at} /></dd></div>
                      <div className="rounded-lg border p-2"><dt className="text-muted-foreground">{t("sysActivity.users.req24h")}</dt><dd className="text-base font-black tabular-nums">{formatNumber(item.requests_24h, locale)}</dd></div>
                      <div className="rounded-lg border p-2"><dt className="text-muted-foreground">{t("sysActivity.users.req7d")}</dt><dd className="text-base font-black tabular-nums">{formatNumber(item.requests_7d, locale)}</dd></div>
                    </dl>
                    <div className="truncate text-xs text-muted-foreground">{item.last_action_label ?? "—"}{item.last_ip ? <> · <Ltr as="span" className="font-mono">{item.last_ip}</Ltr></> : null}</div>
                    <Button type="button" variant="outline" size="sm" onClick={() => onOpenFeed(item.user.id)}><History />{t("sysActivity.users.viewFeed")}</Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
          <Pagination page={state.page} pageSize={state.pageSize} count={list.data?.count ?? 0} onPage={state.setPage} onPageSize={state.setPageSize} />
        </>
      )}
    </div>
  );
}

/** System activity (System administration): who asked the system for what, live, plus a per-user rollup. */
export function SystemActivityPage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams?.get("tab"));
  const go = (query: URLSearchParams) => { const text = query.toString(); router.replace(text ? `?${text}` : "?", { scroll: false }); };
  const selectTab = (next: string) => {
    // Each tab has its own filters: only the tab itself survives a switch.
    const query = new URLSearchParams();
    if (parseTab(next) === "users") query.set("tab", "users");
    go(query);
  };
  const openFeedFor = (userId: number) => go(new URLSearchParams({ user: String(userId) }));
  return (
    <CapabilityGate capability={CAPABILITIES.audit}>
      <div className="space-y-5">
        <PageHeader title={t("sysActivity.title")} description={t("sysActivity.subtitle")} eyebrow={t("nav.governance")} />
        <Tabs value={tab} onValueChange={selectTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="live"><Gauge className="me-1.5 size-4" aria-hidden />{t("sysActivity.tab.live")}</TabsTrigger>
            <TabsTrigger value="users"><Users className="me-1.5 size-4" aria-hidden />{t("sysActivity.tab.users")}</TabsTrigger>
          </TabsList>
          <TabsContent value="live"><LiveFeed /></TabsContent>
          <TabsContent value="users"><UsersRollup onOpenFeed={openFeedFor} /></TabsContent>
        </Tabs>
      </div>
    </CapabilityGate>
  );
}
