import type { UserRole } from "@/types/roles";

export interface User {
  id: number;
  full_name: string;
  email: string;
  phone_number?: string;
  role: UserRole;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}
