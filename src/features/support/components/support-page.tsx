"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTableRowActions } from "@/components/data-table/data-table-row-actions";
import { DetailDialog } from "@/components/shared/detail-dialog";
import { FieldGrid, FieldItem } from "@/components/shared/field-grid";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { StatusActionDialog } from "@/components/shared/status-action-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { TablePageShell } from "@/components/shared/table-page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/features/academic/components/helpers";
import { useSupportMutation, useSupportTicket, useSupportTickets } from "@/features/support/hooks";
import type { SupportTicket } from "@/features/support/types";
import { listData } from "@/lib/api/crud";
import { readString } from "@/lib/object";

const statusOptions = ["open", "in_progress", "waiting_user", "resolved", "closed"].map((value) => ({ label: value, value }));
const priorityOptions = ["low", "medium", "high", "urgent"].map((value) => ({ label: value, value }));

export function SupportPage() {
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [action, setAction] = useState<"status" | "priority" | "assign" | "reply" | null>(null);
  const listQuery = useSupportTickets();
  const detailQuery = useSupportTicket(selected?.id);
  const mutation = useSupportMutation();
  const rows = listData(listQuery.data);
  const columns = useMemo<ColumnDef<SupportTicket>[]>(() => [
    { accessorKey: "id", header: ({ column }) => <DataTableColumnHeader column={column} title="Ticket ID" /> },
    { accessorKey: "user", header: "User", cell: ({ row }) => readString(row.original, ["user.full_name", "user.email"]) },
    { accessorKey: "category", header: "Category" },
    { accessorKey: "subject", header: "Subject" },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { accessorKey: "priority", header: "Priority", cell: ({ row }) => <PriorityBadge priority={row.original.priority ?? "medium"} /> },
    { accessorKey: "assigned_to", header: "Assigned", cell: ({ row }) => readString(row.original, ["assigned_to.full_name", "assigned_to.email"]) },
    { accessorKey: "created_at", header: "Created", cell: ({ row }) => formatDate(row.original.created_at) },
    { id: "actions", cell: ({ row }) => <DataTableRowActions row={row.original} actions={[
      { label: "View details", onClick: setSelected },
      { label: "Update status", onClick: (record) => { setSelected(record); setAction("status"); } },
      { label: "Change priority", onClick: (record) => { setSelected(record); setAction("priority"); } },
      { label: "Assign", onClick: (record) => { setSelected(record); setAction("assign"); } },
      { label: "Reply", onClick: (record) => { setSelected(record); setAction("reply"); } },
    ]} /> },
  ], []);
  const detail = detailQuery.data ?? selected;

  return (
    <TablePageShell title="Support Tickets" description="Manage support queue, status, priority, assignment, and replies." error={listQuery.error} onRetry={() => listQuery.refetch()}>
      <DataTable columns={columns} data={rows} loading={listQuery.isLoading} searchPlaceholder="Search support tickets" />
      <DetailDialog open={Boolean(selected) && !action} onOpenChange={(next) => !next && setSelected(null)} title={`Ticket ${detail?.id ?? ""}`}>
        {detail ? <div className="space-y-4">
          <FieldGrid title="Ticket">
            <FieldItem label="User" value={readString(detail, ["user.full_name", "user.email"])} />
            <FieldItem label="Category" value={detail.category ?? "-"} />
            <FieldItem label="Subject" value={detail.subject ?? "-"} />
            <FieldItem label="Status" value={<StatusBadge status={detail.status} />} />
            <FieldItem label="Priority" value={<PriorityBadge priority={detail.priority ?? "medium"} />} />
            <FieldItem label="Assigned to" value={readString(detail, ["assigned_to.full_name", "assigned_to.email"])} />
          </FieldGrid>
          <div className="space-y-3">
            <h3 className="font-semibold">Messages</h3>
            {(detail.messages ?? []).map((message) => (
              <Card key={message.id ?? message.created_at}>
                <CardContent className="p-4">
                  <p className="text-sm font-medium">{readString(message, ["sender.full_name", "sender.email"])}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{message.message ?? message.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{formatDate(message.created_at)}</p>
                </CardContent>
              </Card>
            ))}
            {!(detail.messages ?? []).length ? <p className="text-sm text-muted-foreground">No messages available.</p> : null}
          </div>
        </div> : null}
      </DetailDialog>
      <StatusActionDialog
        open={Boolean(action)}
        onOpenChange={(next) => !next && setAction(null)}
        title={action === "priority" ? "Change priority" : action === "assign" ? "Assign ticket" : action === "reply" ? "Reply to ticket" : "Update status"}
        submitLabel="Save"
        loading={mutation.isPending}
        options={action === "status" ? { field: "status", label: "Status", items: statusOptions } : action === "priority" ? { field: "priority", label: "Priority", items: priorityOptions } : undefined}
        fields={action === "assign" ? ["assigned_to"] : action === "reply" ? ["message"] : []}
        onSubmit={async (values) => {
          if (!selected || !action) return;
          await mutation.mutateAsync({ id: selected.id, type: action, status: values.status, priority: values.priority, assigned_to: values.assigned_to, message: values.message });
          setAction(null);
        }}
      />
    </TablePageShell>
  );
}
