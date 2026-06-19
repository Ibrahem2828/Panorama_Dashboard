import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { listItems, type QueryParams } from "@/lib/api/crud";
import { requestPreviewToken } from "@/lib/api/protected-media";
import { unwrapApiResponse } from "@/lib/api/response";
import type { ApiResponse } from "@/types/api";
import type { PrintOrder } from "@/features/printing/types";

const base = endpoints.printing.orders;
export const listPrintOrders = (params?: QueryParams) => listItems<PrintOrder>(base, params);
export const getPrintOrder = (id: number | string) => apiClient.get<ApiResponse<PrintOrder>>(endpoints.printing.detail(id)).then((r) => unwrapApiResponse(r.data));
export const assignPrintOrder = (id: number | string, assigned_to?: string) => apiClient.patch<ApiResponse<PrintOrder>>(endpoints.printing.assign(id), assigned_to ? { assigned_to: Number(assigned_to) } : {}).then((r) => unwrapApiResponse(r.data));
export const updatePrintStatus = (id: number | string, status: string, note?: string) => apiClient.patch<ApiResponse<PrintOrder>>(endpoints.printing.status(id), { status, note }).then((r) => unwrapApiResponse(r.data));
export const addPrintNote = (id: number | string, internal_notes?: string) => apiClient.post<ApiResponse<PrintOrder>>(endpoints.printing.note(id), { internal_notes }).then((r) => unwrapApiResponse(r.data));
export const getPrintOrderFilePreviewToken = (orderId: number | string, itemId?: number | string) =>
  requestPreviewToken(endpoints.printing.filePreviewToken(orderId), itemId ? { item_id: itemId } : undefined);
