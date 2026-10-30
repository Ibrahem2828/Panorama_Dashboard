"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { FilterBar, FilterEmptyState, type FilterSegment } from "@/components/filters/filter-bar";
import { toQueryString } from "@/components/filters/filter-state";
import { LOOKUPS, useLookupOptions } from "@/components/filters/use-lookup-options";
import { EMPTY_LOOKUPS, academicFields, useAcademicLookups } from "@/components/filters/academic-filters";
import { useFilterState } from "@/components/filters/use-filter-state";
import { Pagination } from "@/components/data-grid/pagination";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { Ltr } from "@/components/shared/ltr";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/status-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCan } from "@/features/session";
import {
  STATUS_LABEL_KEY, STUDENT_SORTS, SUMMARY_OMIT, VERIFICATION_STATUSES, isVerificationStatus, studentFields, studentSchema, studentsCsv,
  type StudentRow, type StudentSummary,
} from "@/features/students/students-rules";
import { UserLink, userProfilePath } from "@/features/users/user-link";
import { useI18n } from "@/i18n/provider";
import { localizePath } from "@/i18n/routing";
import { apiFetch, normalizeCollection, unwrap } from "@/lib/api/browser-client";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { formatDate, formatNumber } from "@/lib/utils";

const SORT_KEYS = {
  "-created_at": "students.sort.newest",
  created_at: "students.sort.oldest",
  full_name: "students.sort.nameAsc",
  "-full_name": "students.sort.nameDesc",
  "-last_login": "students.sort.recentLogin",
  last_login: "students.sort.oldestLogin",
  student_number: "students.sort.number",
} as const;

/**
 * Students: every student with verification state, academic placement and activity, filtered from the URL.
 * (Staff accounts and roles stay on the Users page.)
 */
export function StudentsPage() {
  const { t, locale, enumLabel } = useI18n();
  const router = useRouter();
  const canUsers = useCan(CAPABILITIES.users);
  const canVerify = useCan(CAPABILITIES.verification);
  const allowed = canUsers || canVerify;
  const [moreOpened, setMoreOpened] = useState(false);

  // The filter state comes first: its structure (keys, parents) does not depend on the loaded options, which are
  // passed to the bar separately.
  const structure = useMemo(() => studentSchema(studentFields({ t, academic: academicFields(t, EMPTY_LOOKUPS), groups: [] })), [t]);
  const state = useFilterState(structure);
  const academic = useAcademicLookups(allowed);
  const groups = useLookupOptions(LOOKUPS.groups, {}, allowed && (moreOpened || Boolean(state.values.group)));
  const fields = useMemo(() => studentFields({ t, academic: academicFields(t, academic), groups: groups.options }), [t, academic, groups.options]);

  const listParams = state.requestParams;
  const list = useQuery({
    queryKey: ["students", listParams, state.page, state.pageSize],
    queryFn: async () => normalizeCollection<StudentRow>(await apiFetch(`/api/v1/dashboard/students/?${toQueryString(listParams, { page: state.page, page_size: state.pageSize })}`)),
    enabled: allowed,
    placeholderData: keepPreviousData,
  });
  const summaryParams = state.requestParamsWithout(SUMMARY_OMIT);
  const summary = useQuery({
    queryKey: ["students-summary", summaryParams],
    queryFn: async () => unwrap(apiFetch<StudentSummary>(`/api/v1/dashboard/students/summary/?${toQueryString(summaryParams)}`)),
    enabled: allowed,
    placeholderData: keepPreviousData,
  });

  const statusLabel = (status: string) => (isVerificationStatus(status) ? t(STATUS_LABEL_KEY[status]) : enumLabel(status));
  const segments = useMemo<FilterSegment[]>(() => [
    { value: "", label: t("students.segment.all"), count: summary.data?.total },
    ...VERIFICATION_STATUSES.map((status) => ({ value: status, label: t(STATUS_LABEL_KEY[status]), count: summary.data ? (summary.data.by_verification_status[status] ?? 0) : undefined })),
  ], [summary.data, t]);
  const sortOptions = useMemo(() => STUDENT_SORTS.map((value) => ({ value, label: t(SORT_KEYS[value]) })), [t]);

  const rows = list.data?.results ?? [];
  const exportCsv = () => {
    const labels = (["name", "number", "email", "phone", "verification", "university", "faculty", "major", "year", "semester", "groups", "pending", "active", "lastLogin", "registered"] as const)
      .map((key) => t(`students.csv.${key}` as "students.csv.name"));
    const blob = new Blob([studentsCsv(rows, labels, statusLabel)], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "students.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const open = (id: number) => router.push(localizePath(locale, userProfilePath(id)));

  if (!allowed) return <AccessDenied />;
  return (
    <div className="space-y-5">
      <PageHeader
        title={t("students.title")}
        description={t("students.subtitle")}
        eyebrow={t("nav.administration")}
        actions={
          <>
            <Button variant="outline" onClick={() => { void list.refetch(); void summary.refetch(); }} disabled={list.isFetching}><RefreshCw className={list.isFetching ? "animate-spin motion-reduce:animate-none" : ""} />{t("common.refresh")}</Button>
            <Button variant="outline" onClick={exportCsv} disabled={!rows.length} title={t("students.exportHint")}><Download />{t("students.export")}</Button>
          </>
        }
      />
      <FilterBar
        state={state}
        fields={fields}
        segments={segments}
        sortOptions={sortOptions}
        searchPlaceholder={t("students.searchPlaceholder")}
        resultCount={list.data?.count ?? null}
        loading={list.isFetching && !list.isPending}
        onMoreOpenChange={(opened) => { if (opened) setMoreOpened(true); }}
      />

      {list.isPending ? (
        <div className="space-y-3" aria-busy="true"><Skeleton className="h-14 rounded-xl" /><Skeleton className="h-80 rounded-xl" /></div>
      ) : list.isError && !list.data ? (
        <ErrorPanel error={list.error} retry={() => void list.refetch()} />
      ) : rows.length === 0 ? (
        <FilterEmptyState state={state} message={t("students.empty")} />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/55">
                    {(["name", "verification", "academic", "term", "groups", "pending", "lastLogin", "account"] as const).map((key) => (
                      <TableHead key={key} className="whitespace-nowrap font-bold">{t(`students.col.${key}` as "students.col.name")}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} className="cursor-pointer" onClick={(event) => { if (!(event.target as HTMLElement).closest("a,button")) open(row.id); }}>
                      <TableCell className="py-3">
                        <UserLink userId={row.id} name={row.full_name} className="font-semibold" />
                        {row.student_number ? <Ltr as="span" className="block text-xs text-muted-foreground">{row.student_number}</Ltr> : null}
                      </TableCell>
                      <TableCell><StatusPill value={row.verification_status} label={statusLabel(row.verification_status)} /></TableCell>
                      <TableCell>
                        <span className="block max-w-56 truncate" title={row.faculty?.name ?? undefined}>{row.faculty?.name ?? "—"}</span>
                        {row.major ? <span className="block max-w-56 truncate text-xs text-muted-foreground" title={row.major.name}>{row.major.name}</span> : null}
                      </TableCell>
                      <TableCell>
                        <span className="block">{row.academic_year?.name ?? "—"}</span>
                        {row.semester ? <span className="block text-xs text-muted-foreground">{row.semester.name}</span> : null}
                      </TableCell>
                      <TableCell className="tabular-nums">{formatNumber(row.groups_count, locale)}</TableCell>
                      <TableCell>{row.pending_enrollments > 0 ? <Badge variant="warning">{formatNumber(row.pending_enrollments, locale)}</Badge> : <span className="text-muted-foreground">0</span>}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{row.last_login ? formatDate(row.last_login, locale) : <span className="text-muted-foreground">{t("students.neverLoggedIn")}</span>}</TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <StatusPill value={row.is_active ? "active" : "inactive"} label={row.is_active ? t("common.active") : t("students.disabled")} />
                          {row.needs_term_confirmation ? <Badge variant="info">{t("students.needsTermConfirmation")}</Badge> : null}
                        </div>
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
    </div>
  );
}
