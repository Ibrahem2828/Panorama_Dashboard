import { NextResponse } from "next/server";

import type { ApiEnvelope } from "@/types/api";

export function jsonError(
  status: number,
  code: string,
  message: string,
  requestId: string,
  errors?: Record<string, unknown> | null,
) {
  const payload: ApiEnvelope<null> = {
    success: false,
    data: null,
    code,
    message,
    errors: errors ?? undefined,
    id_request: requestId,
  };
  return NextResponse.json(payload, { status, headers: { "x-request-id": requestId, "cache-control": "no-store" } });
}

