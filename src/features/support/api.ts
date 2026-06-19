import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { listItems, type QueryParams } from "@/lib/api/crud";
import { unwrapApiResponse } from "@/lib/api/response";
import type { ApiResponse } from "@/types/api";
import type { SupportTicket } from "@/features/support/types";

const base = endpoints.support.tickets;
export const listSupportTickets = (params?: QueryParams) => listItems<SupportTicket>(base, params);
export const getSupportTicket = (id: number | string) => apiClient.get<ApiResponse<SupportTicket>>(`${base}${id}/`).then((r) => unwrapApiResponse(r.data));
export const updateTicketStatus = (id: number | string, status?: string) => apiClient.patch<ApiResponse<SupportTicket>>(`${base}${id}/status/`, { status }).then((r) => unwrapApiResponse(r.data));
export const updateTicketPriority = (id: number | string, priority?: string) => apiClient.patch<ApiResponse<SupportTicket>>(`${base}${id}/priority/`, { priority }).then((r) => unwrapApiResponse(r.data));
export const assignTicket = (id: number | string, assigned_to?: string) => apiClient.post<ApiResponse<SupportTicket>>(`${base}${id}/assign/`, assigned_to ? { assigned_to: Number(assigned_to) } : {}).then((r) => unwrapApiResponse(r.data));
export const replyTicket = (id: number | string, message?: string) => apiClient.post<ApiResponse<SupportTicket>>(`${base}${id}/messages/`, { message }).then((r) => unwrapApiResponse(r.data));
