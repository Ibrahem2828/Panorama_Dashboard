import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { createItem, deleteItem, listItems, type QueryParams, updateItem } from "@/lib/api/crud";
import { toFormData } from "@/lib/api/form-data";
import { unwrapApiResponse } from "@/lib/api/response";
import type { ApiResponse } from "@/types/api";
import type { Group, GroupFormValues, GroupMembership } from "@/features/groups/types";

const base = endpoints.groups.list;

export const listGroups = (params?: QueryParams) => listItems<Group>(base, params);
export const createGroup = (values: GroupFormValues) => createItem<Group, FormData | Record<string, unknown>>(base, groupPayload(values));
export const updateGroup = (id: number, values: GroupFormValues) => updateItem<Group, FormData | Record<string, unknown>>(base, id, groupPayload(values));
export const deleteGroup = (id: number) => deleteItem(base, id);
export const listMemberships = (groupId: number, params?: QueryParams) => listItems<GroupMembership>(`${base}${groupId}/memberships/`, params);
export const listJoinRequests = (groupId: number) => listItems<GroupMembership>(`${base}${groupId}/join-requests/`);

export const membershipAction = (id: number, action: "approve" | "reject" | "block") =>
  apiClient.post<ApiResponse<GroupMembership>>(`/api/v1/dashboard/group-memberships/${id}/${action}/`, {}).then((response) => unwrapApiResponse(response.data));

export const updateMembershipRole = (id: number, role: string) =>
  apiClient.patch<ApiResponse<GroupMembership>>(`/api/v1/dashboard/group-memberships/${id}/role/`, { role }).then((response) => unwrapApiResponse(response.data));

function groupPayload(values: GroupFormValues) {
  const payload = {
    name: values.name,
    description: values.description,
    image: values.image,
    university: values.university,
    faculty: values.faculty,
    major: values.major,
    academic_year: values.academic_year,
    semester: values.semester,
    subject: values.subject,
    requires_approval: values.requires_approval,
    send_messages_permission: values.send_messages_permission,
    is_active: values.is_active,
  };

  return values.image ? toFormData(payload) : payload;
}
