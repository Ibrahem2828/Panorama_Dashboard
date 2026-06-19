"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Check, FileImage, RefreshCcw, X } from "lucide-react";
import { useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTableRowActions } from "@/components/data-table/data-table-row-actions";
import { DetailDialog } from "@/components/shared/detail-dialog";
import { FieldGrid, FieldItem } from "@/components/shared/field-grid";
import { AccessDenied } from "@/components/shared/access-denied";
import { ProtectedMediaButton } from "@/components/shared/protected-media-button";
import { StatusActionDialog } from "@/components/shared/status-action-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { TablePageShell } from "@/components/shared/table-page-shell";
import { Button } from "@/components/ui/button";
import { listData } from "@/lib/api/crud";
import { readString } from "@/lib/object";
import { formatDate, getRelatedName } from "@/features/academic/components/helpers";
import { getVerificationCardPreviewToken } from "@/features/verification/api";
import { useVerification, useVerificationAction, useVerifications } from "@/features/verification/hooks";
import type { VerificationRequest } from "@/features/verification/types";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canManageVerification } from "@/lib/permissions";

export function VerificationPage() {
  const user = useCurrentUser();
  const [selected, setSelected] = useState<VerificationRequest | null>(null);
  const [decision, setDecision] = useState<"reject" | "needs_update" | null>(null);
  const listQuery = useVerifications();
  const detailQuery = useVerification(selected?.id);
  const actionMutation = useVerificationAction();
  const rows = listData(listQuery.data);

  const columns = useMemo<ColumnDef<VerificationRequest>[]>(() => [
    { accessorKey: "full_name", header: ({ column }) => <DataTableColumnHeader column={column} title="Student" />, cell: ({ row }) => readString(row.original, ["user.full_name", "student.full_name", "full_name"]) },
    { accessorKey: "email", header: "Email", cell: ({ row }) => readString(row.original, ["user.email", "student.email", "email"]) },
    { accessorKey: "phone", header: "Phone", cell: ({ row }) => readString(row.original, ["user.phone_number", "student.phone_number", "phone_number", "phone"]) },
    { accessorKey: "student_number", header: "Student No.", cell: ({ row }) => readString(row.original, ["student_number"]) },
    { accessorKey: "detected_faculty_name", header: "Detected Faculty", cell: ({ row }) => readString(row.original, ["detected_faculty_name"]) },
    { accessorKey: "faculty", header: "Selected Faculty", cell: ({ row }) => getRelatedName(row.original.selected_faculty ?? row.original.faculty) },
    { accessorKey: "major", header: "Major", cell: ({ row }) => getRelatedName(row.original.major) },
    { accessorKey: "academic_year", header: "Year", cell: ({ row }) => getRelatedName(row.original.academic_year) },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { accessorKey: "created_at", header: "Created", cell: ({ row }) => formatDate(row.original.created_at) },
    {
      id: "actions",
      cell: ({ row }) => (
        <DataTableRowActions
          row={row.original}
          actions={[
            { label: "View details", onClick: setSelected },
            { label: "Approve", onClick: (record) => actionMutation.mutate({ id: record.id, action: "approve" }) },
            { label: "Reject", onClick: (record) => { setSelected(record); setDecision("reject"); }, destructive: true },
            { label: "Needs update", onClick: (record) => { setSelected(record); setDecision("needs_update"); } },
          ]}
        />
      ),
    },
  ], [actionMutation]);

  if (!canManageVerification(user?.role)) {
    return <AccessDenied title="Verification restricted" description="Verification review is limited to it_support and admin." />;
  }

  const detail = detailQuery.data ?? selected;
  return (
    <TablePageShell
      title="Verification Requests"
      description="Review student identity and academic verification requests. (طلبات التحقق)"
      error={listQuery.error}
      onRetry={() => listQuery.refetch()}
    >
      <DataTable
        columns={columns}
        data={rows}
        loading={listQuery.isLoading}
        searchPlaceholder="Search by name, email, or student number"
        emptyTitle="No verification requests"
        emptyDescription="New student verification requests will appear here."
      />
      <DetailDialog
        open={Boolean(selected) && !decision}
        onOpenChange={(open) => !open && setSelected(null)}
        title="Verification detail"
        description="Parsed student number, selected academic data, and submitted card image."
      >
        {detail ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <ConfirmDialog
                trigger={<Button size="sm"><Check />Approve</Button>}
                title="Approve verification"
                description="This will mark the student as verified."
                confirmLabel="Approve"
                onConfirm={() => actionMutation.mutate({ id: detail.id, action: "approve" })}
              />
              <Button size="sm" variant="destructive" onClick={() => setDecision("reject")}><X />Reject</Button>
              <Button size="sm" variant="outline" onClick={() => setDecision("needs_update")}><RefreshCcw />Needs update</Button>
            </div>
            <FieldGrid title="Student info">
              <FieldItem label="Name" value={readString(detail, ["user.full_name", "student.full_name", "full_name"])} />
              <FieldItem label="Email" value={readString(detail, ["user.email", "student.email", "email"])} />
              <FieldItem label="Phone" value={readString(detail, ["user.phone_number", "student.phone_number", "phone_number", "phone"])} />
              <FieldItem label="Student number" value={readString(detail, ["student_number"])} />
            </FieldGrid>
            <FieldGrid title="Parsed student number">
              <FieldItem label="Detected faculty code" value={readString(detail, ["detected_faculty_code"])} />
              <FieldItem label="Detected faculty name" value={readString(detail, ["detected_faculty_name"])} />
              <FieldItem label="Enrollment year" value={readString(detail, ["enrollment_year"])} />
              <FieldItem label="Serial number" value={readString(detail, ["serial_number"])} />
            </FieldGrid>
            <FieldGrid title="Selected academic data">
              <FieldItem label="University" value={getRelatedName(detail.university)} />
              <FieldItem label="Faculty" value={getRelatedName(detail.selected_faculty ?? detail.faculty)} />
              <FieldItem label="Major" value={getRelatedName(detail.major)} />
              <FieldItem label="Academic year" value={getRelatedName(detail.academic_year)} />
              <FieldItem label="Semester" value={getRelatedName(detail.semester)} />
              <FieldItem label="Status" value={<StatusBadge status={detail.status} />} />
            </FieldGrid>
            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">Card image</h3>
                <ProtectedMediaButton getPreviewToken={() => getVerificationCardPreviewToken(detail.id)}>
                  Open protected preview
                </ProtectedMediaButton>
              </div>
              <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed bg-muted/40 text-muted-foreground">
                <div className="text-center">
                  <FileImage className="mx-auto mb-2 size-8" aria-hidden="true" />
                  <p className="text-sm">Card image is available through a short-lived protected preview link.</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </DetailDialog>
      <StatusActionDialog
        open={Boolean(decision)}
        onOpenChange={(open) => !open && setDecision(null)}
        title={decision === "reject" ? "Reject verification" : "Request an update"}
        description="Provide a clear reason for the student and optional internal admin note."
        submitLabel={decision === "reject" ? "Reject" : "Send update request"}
        loading={actionMutation.isPending}
        fields={["rejection_reason", "admin_note"]}
        onSubmit={async (values) => {
          if (!selected || !decision) return;
          await actionMutation.mutateAsync({
            id: selected.id,
            action: decision,
            payload: { rejection_reason: values.rejection_reason, admin_note: values.admin_note },
          });
          setDecision(null);
        }}
      />
    </TablePageShell>
  );
}
