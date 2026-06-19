"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTableRowActions } from "@/components/data-table/data-table-row-actions";
import { DetailDialog } from "@/components/shared/detail-dialog";
import { FieldGrid, FieldItem } from "@/components/shared/field-grid";
import { TablePageShell } from "@/components/shared/table-page-shell";
import { formatDate } from "@/features/academic/components/helpers";
import { useAuditLogs } from "@/features/audit/hooks";
import type { AuditLog } from "@/features/audit/types";
import { listData } from "@/lib/api/crud";
import { readString } from "@/lib/object";

function formatAuditValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") {
    if (v.toLowerCase().includes("redact")) return "[REDACTED]";
    return v;
  }
  if (typeof v === "object") {
    const str = JSON.stringify(v);
    if (str.toLowerCase().includes("redact")) return "[REDACTED]";
  }
  const s = JSON.stringify(v, null, 2);
  return s.length > 800 ? s.slice(0, 800) + "..." : s;
}

export function AuditPage() {
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const listQuery = useAuditLogs();
  const rows = listData(listQuery.data);
  const columns = useMemo<ColumnDef<AuditLog>[]>(() => [
    { accessorKey: "actor", header: "Actor", cell: ({ row }) => readString(row.original, ["actor.full_name", "actor.email"]) },
    { accessorKey: "action", header: ({ column }) => <DataTableColumnHeader column={column} title="Action" /> },
    { accessorKey: "target_type", header: "Target type" },
    { accessorKey: "target_id", header: "Target ID" },
    { accessorKey: "ip_address", header: "IP address" },
    { accessorKey: "created_at", header: "Created", cell: ({ row }) => formatDate(row.original.created_at) },
    { id: "actions", cell: ({ row }) => <DataTableRowActions row={row.original} actions={[{ label: "View details", onClick: setSelected }]} /> },
  ], []);

  return (
    <TablePageShell title="Audit Logs" description="Read-only administrative activity log. Sensitive values are redacted by backend." error={listQuery.error} onRetry={() => listQuery.refetch()}>
      <DataTable columns={columns} data={rows} loading={listQuery.isLoading} searchPlaceholder="Search logs" />
      <DetailDialog open={Boolean(selected)} onOpenChange={(next) => !next && setSelected(null)} title="Audit log detail">
        {selected ? <FieldGrid title="Sensitive values are redacted by backend">
          <FieldItem label="Actor" value={readString(selected, ["actor.full_name", "actor.email"])} />
          <FieldItem label="Action" value={selected.action ?? "-"} />
          <FieldItem label="Target" value={`${selected.target_type ?? "-"} #${selected.target_id ?? "-"}`} />
          <FieldItem label="IP address" value={selected.ip_address ?? "-"} />
          <FieldItem label="User agent" value={selected.user_agent ?? "-"} />
          <FieldItem label="Old value" value={<pre className="max-w-full overflow-auto text-xs">{formatAuditValue(selected.old_value)}</pre>} />
          <FieldItem label="New value" value={<pre className="max-w-full overflow-auto text-xs">{formatAuditValue(selected.new_value)}</pre>} />
          <p className="text-xs text-muted-foreground">Redacted fields from backend are shown as-is or [REDACTED].</p>
          <FieldItem label="Created" value={formatDate(selected.created_at)} />
        </FieldGrid> : null}
      </DetailDialog>
    </TablePageShell>
  );
}
