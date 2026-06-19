import { endpoints } from "@/lib/api/endpoints";
import { createItem, deleteItem, listItems, type QueryParams, updateItem } from "@/lib/api/crud";
import { toFormData } from "@/lib/api/form-data";
import type { Announcement, AnnouncementFormValues } from "@/features/announcements/types";

const base = endpoints.announcements.list;

export const listAnnouncements = (params?: QueryParams) => listItems<Announcement>(base, params);
export const createAnnouncement = (values: AnnouncementFormValues) => createItem<Announcement, FormData | Record<string, unknown>>(base, payload(values));
export const updateAnnouncement = (id: number, values: AnnouncementFormValues) => updateItem<Announcement, FormData | Record<string, unknown>>(base, id, payload(values));
export const deleteAnnouncement = (id: number) => deleteItem(base, id);

function payload(values: AnnouncementFormValues) {
  const data = { ...values };
  return values.image ? toFormData(data) : data;
}
