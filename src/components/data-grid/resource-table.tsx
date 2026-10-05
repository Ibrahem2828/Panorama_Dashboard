"use client";

import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePreferences } from "@/features/preferences";
import { useI18n } from "@/i18n/provider";
import { compactJson, formatDate, formatNumber, humanize } from "@/lib/utils";

export interface ResourceColumn {
  key: string;
  label?: string;
  render?: (value: unknown, row: Record<string, unknown>) => ReactNode;
}

function displayValue(key: string, value: unknown, locale: string) {
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  if (typeof value === "boolean") return value ? "✓" : "—";
  if (key.includes("_at") || key.endsWith("date") || key.endsWith("datetime")) return formatDate(value, locale);
  if (typeof value === "number") return formatNumber(value, locale);
  if (typeof value === "object") return <span className="block max-w-72 truncate font-mono text-xs text-muted-foreground">{compactJson(value)}</span>;
  return <span className="block max-w-72 truncate" title={String(value)}>{String(value)}</span>;
}

export function ResourceTable({ rows, columns, canEdit, canDelete, onView, onEdit, onDelete, emptyMessage }: {
  rows: Record<string, unknown>[];
  columns: ResourceColumn[];
  canEdit?: boolean;
  canDelete?: boolean;
  onView: (row: Record<string, unknown>) => void;
  onEdit: (row: Record<string, unknown>) => void;
  onDelete: (row: Record<string, unknown>) => void;
  emptyMessage?: string;
}) {
  const { t, locale } = useI18n();
  const density = usePreferences((state) => state.density);
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow className="bg-muted/55">{columns.map((column) => <TableHead key={column.key} className="whitespace-nowrap font-bold">{column.label ?? humanize(column.key)}</TableHead>)}<TableHead className="w-16"><span className="sr-only">{t("common.actions")}</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={String(row.id ?? index)} className="group">
                {columns.map((column) => <TableCell key={column.key} className={density === "compact" ? "py-2" : "py-3.5"}>{column.render ? column.render(row[column.key], row) : displayValue(column.key, row[column.key], locale)}</TableCell>)}
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={t("common.actions")}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onView(row)}><Eye />{t("common.view")}</DropdownMenuItem>
                      {canEdit ? <DropdownMenuItem onClick={() => onEdit(row)}><Pencil />{t("common.edit")}</DropdownMenuItem> : null}
                      {canDelete ? <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(row)}><Trash2 />{t("common.delete")}</DropdownMenuItem> : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length ? <TableRow><TableCell colSpan={columns.length + 1} className="h-36 text-center text-muted-foreground">{emptyMessage ?? t("common.noData")}</TableCell></TableRow> : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
