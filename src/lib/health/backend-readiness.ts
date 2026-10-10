import "server-only";

import { serverEnv } from "@/config/env.server";

const READINESS_TIMEOUT_MS = 2_500;

export async function checkBackendReadiness(): Promise<"ready" | "unavailable"> {
  try {
    const response = await fetch(`${serverEnv.backendApiBaseUrl}/api/v1/health/ready/`, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(READINESS_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    return response.ok ? "ready" : "unavailable";
  } catch {
    return "unavailable";
  }
}
