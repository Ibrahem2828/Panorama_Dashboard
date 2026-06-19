import { endpoints } from "@/lib/api/endpoints";
import { listItems, type QueryParams } from "@/lib/api/crud";
import type { AuditLog } from "@/features/audit/types";

export const listAuditLogs = (params?: QueryParams) => listItems<AuditLog>(endpoints.audit.logs, params);
