import { NextRequest, NextResponse } from "next/server";

import { requestId } from "@/lib/security/request-id";

export function GET(request: NextRequest) {
  const id = requestId(request);
  return NextResponse.json(
    { status: "healthy", dashboard: "live", request_id: id },
    { headers: { "cache-control": "no-store", "x-request-id": id } },
  );
}
