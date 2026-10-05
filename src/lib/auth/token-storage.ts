import type { AuthTokens, User } from "@/types/auth";

/**
 * Deliberately inert compatibility shim. Browser tokens are prohibited; BFF cookies
 * are the only supported session transport.
 */
export const tokenStorage = {
  getAccessToken: (): string | null => null,
  getRefreshToken: (): string | null => null,
  getUser: (): User | null => null,
  setTokens: (): void => undefined,
  setAccessToken: (): void => undefined,
  setRefreshToken: (): void => undefined,
  setUser: (): void => undefined,
  clearSession: (): void => undefined,
};

export type { AuthTokens };
