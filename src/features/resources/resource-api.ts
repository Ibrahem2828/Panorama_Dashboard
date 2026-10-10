"use client";

import { apiFetch, normalizeCollection, unwrap } from "@/lib/api/browser-client";
import type { ResourceDefinition } from "@/contracts/types";
import type { ApiEnvelope, PaginatedData } from "@/types/api";

export type EntityRecord = Record<string, unknown> & { id?: string | number };

export interface ListParameters {
  page: number;
  pageSize: number;
  search?: string;
  ordering?: string;
  filters?: Record<string, string>;
}

export async function listResource(definition: ResourceDefinition, parameters: ListParameters) {
  const query = new URLSearchParams({ page: String(parameters.page), page_size: String(parameters.pageSize) });
  if (parameters.search) query.set("search", parameters.search);
  if (parameters.ordering) query.set("ordering", parameters.ordering);
  for (const [key, value] of Object.entries(parameters.filters ?? {})) if (value) query.set(key, value);
  const payload = await apiFetch<ApiEnvelope<PaginatedData<EntityRecord> | EntityRecord[]> | PaginatedData<EntityRecord> | EntityRecord[]>(`${definition.collectionPath}?${query}`);
  return normalizeCollection<EntityRecord>(payload);
}

function detailPath(definition: ResourceDefinition, id: string | number) {
  if (!definition.detailPath) throw new Error("This resource does not expose a detail route.");
  return definition.detailPath.replace(/\{(?:id|pk)\}/u, encodeURIComponent(String(id)));
}

export async function createResource(definition: ResourceDefinition, body: BodyInit | Record<string, unknown>) {
  const payload = await apiFetch<ApiEnvelope<EntityRecord> | EntityRecord>(definition.collectionPath, { method: "POST", body });
  return unwrap(payload);
}

export async function updateResource(definition: ResourceDefinition, id: string | number, body: BodyInit | Record<string, unknown>) {
  const method = definition.detailMethods.includes("patch") ? "PATCH" : "PUT";
  const payload = await apiFetch<ApiEnvelope<EntityRecord> | EntityRecord>(detailPath(definition, id), { method, body });
  return unwrap(payload);
}

export async function deleteResource(definition: ResourceDefinition, id: string | number) {
  return apiFetch(detailPath(definition, id), { method: "DELETE" });
}

export async function retrieveResource(definition: ResourceDefinition, id: string | number) {
  const payload = await apiFetch<ApiEnvelope<EntityRecord> | EntityRecord>(detailPath(definition, id));
  return unwrap(payload);
}
