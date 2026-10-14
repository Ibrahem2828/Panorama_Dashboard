"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchAllPages, relationLabel } from "@/components/forms/contract-field";
import { REFERENCE_ENDPOINTS } from "@/features/resources/reference-options";

/**
 * Shows the name of a related record (university, subject, group, ...) for a table cell that only holds the id.
 * It reads the same cached reference list the form pickers use, so a page costs one request per relation, not per row.
 */
export function RelationValue({ field, value }: { field: string; value: unknown }) {
  const endpoint = REFERENCE_ENDPOINTS[field];
  const query = useQuery({ queryKey: ["reference-options", endpoint], queryFn: () => fetchAllPages(endpoint ?? ""), enabled: Boolean(endpoint) && value != null, staleTime: 60_000 });
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  const match = query.data?.find((item) => String(item.id) === String(value));
  const label = match ? relationLabel(match) : `#${String(value)}`;
  return <span className="block max-w-56 truncate" title={label}>{label}</span>;
}
