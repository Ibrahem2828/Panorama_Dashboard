import { NextRequest, NextResponse } from "next/server";

import { checkBackendReadiness } from "@/lib/health/backend-readiness";
import { requestId } from "@/lib/security/request-id";

export async function GET(request: NextRequest) {
  const id = requestId(request);
  const backend = await checkBackendReadiness();
  const healthy = backend === "ready";
  return NextResponse.json(
    { status: healthy ? "healthy" : "degraded", dashboard: "ready", backend, request_id: id },
    { status: healthy ? 200 : 503, headers: { "cache-control": "no-store", "x-request-id": id } },
  );
}
