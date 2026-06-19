import { endpoints } from "@/lib/api/endpoints";
import { createItem, deleteItem, listItems, type QueryParams, updateItem } from "@/lib/api/crud";
import { toFormData } from "@/lib/api/form-data";
import { requestPreviewToken } from "@/lib/api/protected-media";
import type { FileFormValues, FileRecord } from "@/features/files/types";

const base = endpoints.files.list;

export const listFiles = (params?: QueryParams) => listItems<FileRecord>(base, params);
export const createFileRecord = (values: FileFormValues) => createItem<FileRecord, FormData | Record<string, unknown>>(base, filePayload(values));
export const updateFileRecord = (id: number, values: FileFormValues) => updateItem<FileRecord, FormData | Record<string, unknown>>(base, id, filePayload(values));
export const deleteFileRecord = (id: number) => deleteItem(base, id);
export const getFilePreviewToken = (id: number) => requestPreviewToken(endpoints.files.previewToken(id));

function filePayload(values: FileFormValues) {
  const payload = {
    title: values.title,
    description: values.description,
    file: values.file,
    visibility: values.visibility,
    university: values.university,
    faculty: values.faculty,
    major: values.major,
    academic_year: values.academic_year,
    semester: values.semester,
    subject: values.subject,
    group: values.group,
    is_printable: values.is_printable,
    is_active: values.is_active,
  };
  return values.file ? toFormData(payload) : payload;
}
