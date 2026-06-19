import type { AuthTokens, User } from "@/types/auth";

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface LoginResponse extends AuthTokens {
  user: User;
}
