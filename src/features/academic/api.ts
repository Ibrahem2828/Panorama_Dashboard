import { endpoints } from "@/lib/api/endpoints";
import { createItem, deleteItem, listItems, type QueryParams, updateItem } from "@/lib/api/crud";
import type { AcademicFormValues, AcademicYear, Faculty, Major, Semester, Subject, University } from "@/features/academic/types";

export const academicEndpoints = {
  universities: endpoints.academic.universities,
  faculties: endpoints.academic.faculties,
  majors: endpoints.academic.majors,
  academicYears: endpoints.academic.academicYears,
  semesters: endpoints.academic.semesters,
  subjects: endpoints.academic.subjects,
} as const;

export type AcademicResourceKey = keyof typeof academicEndpoints;

export type AcademicResourceMap = {
  universities: University;
  faculties: Faculty;
  majors: Major;
  academicYears: AcademicYear;
  semesters: Semester;
  subjects: Subject;
};

export function listAcademic<K extends AcademicResourceKey>(resource: K, params?: QueryParams) {
  return listItems<AcademicResourceMap[K]>(academicEndpoints[resource], params);
}

export function createAcademic<K extends AcademicResourceKey>(resource: K, values: AcademicFormValues) {
  return createItem<AcademicResourceMap[K], Record<string, unknown>>(academicEndpoints[resource], academicPayload(values));
}

export function updateAcademic<K extends AcademicResourceKey>(resource: K, id: number, values: AcademicFormValues) {
  return updateItem<AcademicResourceMap[K], Record<string, unknown>>(academicEndpoints[resource], id, academicPayload(values));
}

export function deleteAcademic(resource: AcademicResourceKey, id: number) {
  return deleteItem(academicEndpoints[resource], id);
}

function academicPayload(values: AcademicFormValues) {
  const payload: Record<string, unknown> = {
    name: values.name,
    is_active: values.is_active,
  };

  if (values.code) payload.code = values.code;
  if (values.description) payload.description = values.description;
  if (values.order) payload.order = Number(values.order);
  if (values.university) payload.university = Number(values.university);
  if (values.faculty) payload.faculty = Number(values.faculty);
  if (values.major) payload.major = Number(values.major);
  if (values.academic_year) payload.academic_year = Number(values.academic_year);
  if (values.semester) payload.semester = Number(values.semester);

  return payload;
}
