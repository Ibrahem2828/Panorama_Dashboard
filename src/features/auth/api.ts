import { bffFetch, unwrap } from "@/lib/api/browser-client";
import type { ApiEnvelope } from "@/types/api";
import type { DashboardSession } from "@/types/auth";
import type { LoginRequest, LoginResponse } from "@/features/auth/types";

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  return unwrap(await bffFetch<ApiEnvelope<DashboardSession>>("/api/auth/login", { method: "POST", body: payload }));
}

export async function getMe(): Promise<DashboardSession> {
  return unwrap(await bffFetch<ApiEnvelope<DashboardSession>>("/api/auth/session"));
}

export async function logout() {
  await bffFetch("/api/auth/logout", { method: "POST" });
}
