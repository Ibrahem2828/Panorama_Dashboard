"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  createAcademic,
  deleteAcademic,
  listAcademic,
  updateAcademic,
  type AcademicResourceKey,
} from "@/features/academic/api";
import type { AcademicFormValues } from "@/features/academic/types";
import { listData, type QueryParams } from "@/lib/api/crud";
import { normalizeApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";

export function useAcademicList<K extends AcademicResourceKey>(resource: K, params?: QueryParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.academic.list(resource, params),
    queryFn: () => listAcademic(resource, params),
    enabled,
  });
}

export function useAcademicOptions<K extends AcademicResourceKey>(resource: K, params?: QueryParams, enabled = true) {
  const query = useAcademicList(resource, params, enabled);
  return {
    ...query,
    options: listData(query.data).map((item) => ({
      label: item.name,
      value: String(item.id),
    })),
  };
}

export function useCreateAcademic(resource: AcademicResourceKey) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: AcademicFormValues) => createAcademic(resource, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.academic.all });
      toast.success("Record created successfully.");
    },
    onError: (error) => {
      const err = normalizeApiError(error);
      toast.error(err.message, { description: err.request_id ? `Request ID: ${err.request_id}` : undefined });
    },
  });
}

export function useUpdateAcademic(resource: AcademicResourceKey) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: AcademicFormValues }) => updateAcademic(resource, id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.academic.all });
      toast.success("Record updated successfully.");
    },
    onError: (error) => {
      const err = normalizeApiError(error);
      toast.error(err.message, { description: err.request_id ? `Request ID: ${err.request_id}` : undefined });
    },
  });
}

export function useDeleteAcademic(resource: AcademicResourceKey) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteAcademic(resource, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.academic.all });
      toast.success("Record deleted successfully.");
    },
    onError: (error) => {
      const err = normalizeApiError(error);
      toast.error(err.message, { description: err.request_id ? `Request ID: ${err.request_id}` : undefined });
    },
  });
}

export const useUniversities = (params?: QueryParams) => useAcademicOptions("universities", params);
export const useFaculties = (universityId?: string) =>
  useAcademicOptions("faculties", { university: universityId }, !universityId || Number.isFinite(Number(universityId)));
export const useMajors = (facultyId?: string) =>
  useAcademicOptions("majors", { faculty: facultyId }, !facultyId || Number.isFinite(Number(facultyId)));
export const useAcademicYears = () => useAcademicOptions("academicYears");
export const useSemesters = () => useAcademicOptions("semesters");
export const useSubjects = (params?: QueryParams) => useAcademicOptions("subjects", params);
