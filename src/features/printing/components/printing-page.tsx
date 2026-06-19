"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTableRowActions } from "@/components/data-table/data-table-row-actions";
import { DetailDialog } from "@/components/shared/detail-dialog";
import { FieldGrid, FieldItem } from "@/components/shared/field-grid";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { ProtectedMediaButton } from "@/components/shared/protected-media-button";
import { StatusActionDialog } from "@/components/shared/status-action-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { TablePageShell } from "@/components/shared/table-page-shell";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/features/academic/components/helpers";
import { getPrintOrderFilePreviewToken } from "@/features/printing/api";
import { usePrintMutation, usePrintOrder, usePrintOrders } from "@/features/printing/hooks";
import type { PrintOrder, PrintOrderItem } from "@/features/printing/types";
import { listData } from "@/lib/api/crud";
import { readNumber, readString } from "@/lib/object";
import { AccessDenied } from "@/components/shared/access-denied";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canManagePrinting } from "@/lib/permissions";

const statuses = ["submitted", "under_review", "accepted", "printing", "ready", "delivered", "rejected", "cancelled"];

export function PrintingPage() {
  const user = useCurrentUser();
  const [status, setStatus] = useState("submitted");
  const [selected, setSelected] = useState<PrintOrder | null>(null);
  const [action, setAction] = useState<"assign" | "status" | "note" | null>(null);
  const listQuery = usePrintOrders({ status });
  const detailQuery = usePrintOrder(selected?.id);
  const mutation = usePrintMutation();
  const rows = listData(listQuery.data);

  const columns = useMemo<ColumnDef<PrintOrder>[]>(() => [
    { accessorKey: "id", header: ({ column }) => <DataTableColumnHeader column={column} title="Order ID" /> },
    { accessorKey: "user", header: "User", cell: ({ row }) => readString(row.original, ["user.full_name", "user.email"]) },
    { accessorKey: "phone", header: "Phone", cell: ({ row }) => readString(row.original, ["user.phone_number", "phone"]) },
    { accessorKey: "role", header: "Role", cell: ({ row }) => readString(row.original, ["user.role", "role"]) },
    { accessorKey: "priority", header: "Priority", cell: ({ row }) => <PriorityBadge priority={row.original.priority} /> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { accessorKey: "items_count", header: "Items", cell: ({ row }) => row.original.items_count ?? row.original.items?.length ?? 0 },
    { accessorKey: "total_price", header: "Total", cell: ({ row }) => readString(row.original, ["total_price"], "0") },
    { accessorKey: "assigned_to", header: "Assigned", cell: ({ row }) => readString(row.original, ["assigned_to.full_name", "assigned_to.email"]) },
    { accessorKey: "created_at", header: "Created", cell: ({ row }) => formatDate(row.original.created_at) },
    { id: "actions", cell: ({ row }) => <DataTableRowActions row={row.original} actions={[
      { label: "View details", onClick: setSelected },
      { label: "Assign", onClick: (record) => { setSelected(record); setAction("assign"); } },
      { label: "Update status", onClick: (record) => { setSelected(record); setAction("status"); } },
      { label: "Add note", onClick: (record) => { setSelected(record); setAction("note"); } },
    ]} /> },
  ], []);
  if (!canManagePrinting(user?.role)) {
    return <AccessDenied title="Printing restricted" description="Printing is accessible to it_support, admin, and print_staff." />;
  }
  const detail = detailQuery.data ?? selected;

  return (
    <TablePageShell title="Printing Orders" description="Operational queue for print staff, admins, and IT support. (أوامر الطباعة) — print_staff default landing." error={listQuery.error} onRetry={() => listQuery.refetch()}>
      <Tabs value={status} onValueChange={setStatus}>
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
          {statuses.map((item) => <TabsTrigger key={item} value={item}>{item}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      <DataTable columns={columns} data={rows} loading={listQuery.isLoading} searchPlaceholder="Search orders" />
      <DetailDialog open={Boolean(selected) && !action} onOpenChange={(next) => !next && setSelected(null)} title={`Print order ${detail?.id ?? ""}`}>
        {detail ? <div className="space-y-4">
          <FieldGrid title="User info">
            <FieldItem label="Name" value={readString(detail, ["user.full_name"])} />
            <FieldItem label="Email" value={readString(detail, ["user.email"])} />
            <FieldItem label="Phone" value={readString(detail, ["user.phone_number", "phone"])} />
            <FieldItem label="Role" value={readString(detail, ["user.role", "role"])} />
          </FieldGrid>
          <FieldGrid title="Order info">
            <FieldItem label="Status" value={<StatusBadge status={detail.status} />} />
            <FieldItem label="Priority" value={<PriorityBadge priority={detail.priority} />} />
            <FieldItem label="Total price" value={readString(detail, ["total_price"], "0")} />
            <FieldItem label="Assigned to" value={readString(detail, ["assigned_to.full_name", "assigned_to.email"])} />
            <FieldItem label="User notes" value={detail.user_notes ?? "-"} />
            <FieldItem label="Internal notes" value={detail.internal_notes ?? "-"} />
            <FieldItem label="Created" value={formatDate(detail.created_at)} />
            <FieldItem label="Completed" value={formatDate(detail.completed_at)} />
          </FieldGrid>
          <p className="text-xs text-muted-foreground">Internal notes are visible to dashboard roles only.</p>
          <DataTable columns={[
            { accessorKey: "file_name", header: "File" },
            {
              id: "preview",
              header: "Preview",
              cell: ({ row }) => {
                const item = row.original as PrintOrderItem;
                return (
                  <ProtectedMediaButton
                    getPreviewToken={() => getPrintOrderFilePreviewToken(detail.id, item.id)}
                    disabled={!item.id}
                  >
                    Open
                  </ProtectedMediaButton>
                );
              },
            },
            { accessorKey: "copies", header: "Copies" },
            { accessorKey: "color_mode", header: "Color" },
            { accessorKey: "paper_size", header: "Paper" },
            { accessorKey: "sides", header: "Sides" },
            { accessorKey: "binding", header: "Binding" },
            { accessorKey: "pages_count", header: "Pages", cell: ({ row }) => readNumber(row.original, ["pages_count"]) },
            { accessorKey: "price", header: "Price" },
          ]} data={detail.items ?? []} emptyTitle="No order items" />
          <DataTable columns={[
            { accessorKey: "old_status", header: "Old" },
            { accessorKey: "new_status", header: "New", cell: ({ row }) => <StatusBadge status={row.original.new_status ?? "-"} /> },
            { accessorKey: "changed_by", header: "Changed by", cell: ({ row }) => readString(row.original, ["changed_by.full_name", "changed_by.email"]) },
            { accessorKey: "note", header: "Note" },
            { accessorKey: "created_at", header: "Created", cell: ({ row }) => formatDate(row.original.created_at) },
          ]} data={detail.status_history ?? []} emptyTitle="No status history" />
        </div> : null}
      </DetailDialog>
      <StatusActionDialog
        open={Boolean(action)}
        onOpenChange={(next) => !next && setAction(null)}
        title={action === "assign" ? "Assign print order" : action === "note" ? "Add internal note" : "Update print status"}
        submitLabel="Save"
        loading={mutation.isPending}
        options={action === "status" ? { field: "status", label: "Status", items: statuses.map((value) => ({ label: value, value })) } : undefined}
        fields={action === "assign" ? ["assigned_to"] : action === "note" ? ["internal_notes"] : ["note"]}
        onSubmit={async (values) => {
          if (!selected || !action) return;
          await mutation.mutateAsync({ id: selected.id, type: action, status: values.status, note: values.note, assigned_to: values.assigned_to, internal_notes: values.internal_notes });
          setAction(null);
        }}
      />
    </TablePageShell>
  );
}
