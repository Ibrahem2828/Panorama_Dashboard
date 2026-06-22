"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { RefreshCw, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTableRowActions } from "@/components/data-table/data-table-row-actions";
import { ErrorState } from "@/components/feedback/error-state";
import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/shared/page-header";
import { StudentAccountRequestStatusBadge } from "@/features/student-account-requests/components/student-account-request-status-badge";
import {
  formatArabicDate,
  getArabicErrorMessage,
  STATUS_FILTER_TABS,
} from "@/features/student-account-requests/constants";
import { useStudentAccountRequests } from "@/features/student-account-requests/hooks";
import type { StudentAccountRequestListItem } from "@/features/student-account-requests/types";
import { getRelatedName } from "@/features/academic/components/helpers";
import { useCurrentUser } from "@/hooks/use-current-user";
import { listData } from "@/lib/api/crud";
import type { PaginatedResponse } from "@/types/api";
import { readString } from "@/lib/object";
import { canManageStudentAccountRequests } from "@/lib/permissions";
import { studentAccountRequestDetail } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PAGE_SIZE = 20;

function getPhoneNumber(record: StudentAccountRequestListItem) {
  return readString(record, ["phone_number", "whatsapp_phone"]);
}

export function StudentAccountRequestsListPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const queryParams = useMemo(() => ({
    page,
    page_size: PAGE_SIZE,
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ordering: "-created_at",
  }), [debouncedSearch, page, statusFilter]);

  const listQuery = useStudentAccountRequests(queryParams);
  const rows = listData(listQuery.data);
  const paginated = Array.isArray(listQuery.data) ? null : (listQuery.data as PaginatedResponse<StudentAccountRequestListItem> | undefined);
  const totalCount = paginated?.count ?? rows.length;
  const hasNext = Boolean(paginated?.next);
  const hasPrevious = Boolean(paginated?.previous);

  const columns = useMemo<ColumnDef<StudentAccountRequestListItem>[]>(() => [
    {
      accessorKey: "full_name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="اسم الطالب" />,
      cell: ({ row }) => readString(row.original, ["full_name"]) || "-",
    },
    {
      accessorKey: "university",
      header: "الجامعة",
      cell: ({ row }) => getRelatedName(row.original.university_detail ?? row.original.university),
    },
    {
      accessorKey: "student_number",
      header: "الرقم الجامعي",
      cell: ({ row }) => readString(row.original, ["student_number"]) || "-",
    },
    {
      accessorKey: "phone_number",
      header: "رقم الجوال/واتساب",
      cell: ({ row }) => <span dir="ltr">{getPhoneNumber(row.original)}</span>,
    },
    {
      accessorKey: "status",
      header: "الحالة",
      cell: ({ row }) => <StudentAccountRequestStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "created_at",
      header: "تاريخ الطلب",
      cell: ({ row }) => formatArabicDate(row.original.created_at),
    },
    {
      id: "actions",
      header: "الإجراءات",
      cell: ({ row }) => (
        <DataTableRowActions
          row={row.original}
          actions={[
            {
              label: "عرض التفاصيل",
              onClick: (record) => router.push(studentAccountRequestDetail(record.id)),
            },
          ]}
        />
      ),
    },
  ], [router]);

  if (!canManageStudentAccountRequests(user?.role)) {
    return (
      <AccessDenied
        title="الوصول مقيّد"
        description="لا تملك صلاحية لعرض طلبات حسابات الطلاب."
      />
    );
  }

  if (listQuery.error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="طلبات حسابات الطلاب"
          description="مراجعة طلبات إنشاء حساب الطالب والتحقق من البطاقة الجامعية قبل إرسال رمز التفعيل."
        />
        <ErrorState message={getArabicErrorMessage(listQuery.error)} onRetry={() => listQuery.refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="طلبات حسابات الطلاب"
        description="مراجعة طلبات إنشاء حساب الطالب والتحقق من البطاقة الجامعية قبل إرسال رمز التفعيل."
        actionLabel="تحديث"
        onAction={() => listQuery.refetch()}
      />

      <Tabs
        value={statusFilter}
        onValueChange={(value) => {
          setStatusFilter(value);
          setPage(1);
        }}
      >
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
          {STATUS_FILTER_TABS.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>{item.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="بحث بالاسم أو البريد أو الرقم الجامعي"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={() => listQuery.refetch()} disabled={listQuery.isFetching}>
          <RefreshCw />
          تحديث
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={listQuery.isLoading}
        emptyTitle="لا توجد طلبات حالياً"
        emptyDescription="ستظهر طلبات إنشاء حسابات الطلاب هنا عند وصولها."
        onRowClick={(record) => router.push(studentAccountRequestDetail(record.id))}
      />

      {totalCount > 0 ? (
        <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>إجمالي الطلبات: {totalCount}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!hasPrevious || listQuery.isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              السابق
            </Button>
            <span>الصفحة {page}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNext || listQuery.isFetching}
              onClick={() => setPage((current) => current + 1)}
            >
              التالي
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}