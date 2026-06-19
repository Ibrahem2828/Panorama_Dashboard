"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createGroup, deleteGroup, listGroups, listJoinRequests, listMemberships, membershipAction, updateGroup, updateMembershipRole } from "@/features/groups/api";
import type { GroupFormValues } from "@/features/groups/types";
import type { QueryParams } from "@/lib/api/crud";
import { normalizeApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";

export const useGroups = (params?: QueryParams) => useQuery({ queryKey: queryKeys.groups.list(params), queryFn: () => listGroups(params) });
export const useGroupMemberships = (groupId?: number) => useQuery({ queryKey: queryKeys.groups.memberships(groupId), queryFn: () => listMemberships(groupId as number), enabled: Boolean(groupId) });
export const useGroupJoinRequests = (groupId?: number) => useQuery({ queryKey: queryKeys.groups.joinRequests(groupId), queryFn: () => listJoinRequests(groupId as number), enabled: Boolean(groupId) });

export function useGroupOptions(params?: QueryParams) {
  const query = useGroups(params);
  return {
    ...query,
    options: Array.isArray(query.data) ? query.data.map((group) => ({ label: group.name, value: String(group.id) })) : query.data?.results.map((group) => ({ label: group.name, value: String(group.id) })) ?? [],
  };
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: GroupFormValues) => createGroup(values),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.groups.all }); toast.success("Group created."); },
    onError: (error) => {
      const err = normalizeApiError(error);
      toast.error(err.message, { description: err.request_id ? `Request ID: ${err.request_id}` : undefined });
    },
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: GroupFormValues }) => updateGroup(id, values),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.groups.all }); toast.success("Group updated."); },
    onError: (error) => {
      const err = normalizeApiError(error);
      toast.error(err.message, { description: err.request_id ? `Request ID: ${err.request_id}` : undefined });
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.groups.all }); toast.success("Group deleted."); },
    onError: (error) => {
      const err = normalizeApiError(error);
      toast.error(err.message, { description: err.request_id ? `Request ID: ${err.request_id}` : undefined });
    },
  });
}

export function useMembershipMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, role }: { id: number; action?: "approve" | "reject" | "block"; role?: string }) =>
      role ? updateMembershipRole(id, role) : membershipAction(id, action ?? "approve"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.groups.all }); toast.success("Membership updated."); },
    onError: (error) => {
      const err = normalizeApiError(error);
      toast.error(err.message, { description: err.request_id ? `Request ID: ${err.request_id}` : undefined });
    },
  });
}
