import type { DashboardSession } from "@/types/auth";

export interface LoginRequest {
  identifier: string;
  password: string;
}

export type LoginResponse = DashboardSession;
