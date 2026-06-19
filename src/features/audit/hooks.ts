"use client";

import { useQuery } from "@tanstack/react-query";

import { listAuditLogs } from "@/features/audit/api";
import type { QueryParams } from "@/lib/api/crud";
import { queryKeys } from "@/lib/api/query-keys";

export const useAuditLogs = (params?: QueryParams) => useQuery({ queryKey: queryKeys.audit.list(params), queryFn: () => listAuditLogs(params) });
