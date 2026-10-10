"use client";

import type { ReactNode } from "react";

import { AccessDenied } from "@/components/feedback/access-denied";
import { useCan } from "@/features/session";

export function CapabilityGate({ capability, children }: { capability?: string; children: ReactNode }) {
  const allowed = useCan(capability);
  return allowed ? children : <AccessDenied />;
}
