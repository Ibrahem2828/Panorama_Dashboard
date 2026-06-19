"use client";

import type { Table } from "@tanstack/react-table";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  searchPlaceholder?: string;
  searchColumn?: string;
  filters?: React.ReactNode;
}

export function DataTableToolbar<TData>({
  table,
  searchPlaceholder = "Search records",
  searchColumn,
  filters,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0 || Boolean(table.getState().globalFilter);
  const searchValue = searchColumn
    ? ((table.getColumn(searchColumn)?.getFilterValue() as string | undefined) ?? "")
    : ((table.getState().globalFilter as string | undefined) ?? "");

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(event) => {
              if (searchColumn) {
                table.getColumn(searchColumn)?.setFilterValue(event.target.value);
              } else {
                table.setGlobalFilter(event.target.value);
              }
            }}
            className="pl-9"
          />
        </div>
        {filters}
        {isFiltered ? (
          <Button variant="ghost" onClick={() => {
            table.resetColumnFilters();
            table.setGlobalFilter("");
          }}>
            Reset
            <X />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
