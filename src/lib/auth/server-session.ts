import "server-only";

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { serverEnv } from "@/config/env.server";
import { backendFetch } from "@/lib/api/backend";
import type { DashboardSession, SessionUser } from "@/types/auth";

export interface SessionTokens { access: string; refresh: string; }
export interface StoredTokens { access?: string; refresh?: string; }

const tokenPairSchema = z.object({
  access: z.string().min(1),
  refresh: z.string().min(1),
}).strict();

export interface RefreshTokensResult {
  tokens: SessionTokens | null;
  status: number;
  upstreamRequestId: string | null;
  retryAfter: string | null;
}

export interface SessionLoadResult {
  session: DashboardSession | null;
  status: number;
  refreshedTokens?: SessionTokens;
  upstreamRequestId?: string | null;
  retryAfter?: string | null;
}

const refreshLocks = new Map<string, Promise<RefreshTokensResult>>();

export function readTokens(request: NextRequest): StoredTokens {
  return {
    access: request.cookies.get(serverEnv.cookieNames.access)?.value,
    refresh: request.cookies.get(serverEnv.cookieNames.refresh)?.value,
  };
}

export async function readSessionTokens(): Promise<SessionTokens | null> {
  const cookieStore = await cookies();
  const access = cookieStore.get(serverEnv.cookieNames.access)?.value;
  const refresh = cookieStore.get(serverEnv.cookieNames.refresh)?.value;
  return access || refresh ? { access: access ?? "", refresh: refresh ?? "" } : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/**
 * The checked-in OpenAPI request contract does not document the 200 body. This
 * boundary accepts only the observed JWT pair, either directly or in the
 * backend's standard `data` envelope. Tokens are never returned to a client.
 */
export function parseBackendLogin(value: unknown): SessionTokens | null {
  const envelope = record(value);
  const body = record(envelope?.data) ?? envelope;
  const parsed = tokenPairSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

export async function refreshTokensResult(refreshToken: string): Promise<RefreshTokensResult> {
  const existing = refreshLocks.get(refreshToken);
  if (existing) return existing;
  const refreshAttempt = (async () => {
    const response = await backendFetch("/api/v1/auth/token/refresh/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });
    return {
      tokens: response.ok ? parseBackendLogin(response.data) : null,
      status: response.status,
      upstreamRequestId: response.upstreamRequestId,
      retryAfter: response.response.headers.get("retry-after"),
    };
  })().finally(() => refreshLocks.delete(refreshToken));
  refreshLocks.set(refreshToken, refreshAttempt);
  return refreshAttempt;
}

export async function refreshTokens(refreshToken: string): Promise<SessionTokens | null> {
  return (await refreshTokensResult(refreshToken)).tokens;
}

function isSessionUser(value: unknown): value is SessionUser {
  const raw = record(value);
  return Boolean(
    raw
    && Number.isInteger(raw.id)
    && typeof raw.full_name === "string"
    && typeof raw.email === "string"
    && typeof raw.role === "string"
    && raw.is_active !== false,
  );
}

export function sessionFromUser(value: unknown): DashboardSession | null {
  if (!isSessionUser(value)) return null;
  const raw = value;
  const backendCapabilities = Array.isArray(raw.effective_capabilities)
    ? raw.effective_capabilities.filter((capability): capability is string => typeof capability === "string")
    : null;
  if (!backendCapabilities || (!backendCapabilities.includes("dashboard.access") && !backendCapabilities.includes("*"))) return null;
  const effectiveCapabilities = backendCapabilities;
  return {
    authenticated: true,
    user: raw,
    role: raw.role,
    capabilities: effectiveCapabilities,
    effectiveCapabilities,
    source: "backend",
    capabilitySource: "backend",
    locale: raw.locale,
  };
}

function refreshFailureResult(refresh: RefreshTokensResult): SessionLoadResult {
  return {
    session: null,
    status: refresh.status,
    upstreamRequestId: refresh.upstreamRequestId,
    retryAfter: refresh.retryAfter,
  };
}

async function backendCurrentUser(access: string) {
  return backendFetch("/api/v1/auth/me/", {
    headers: { Authorization: `Bearer ${access}` },
  });
}

/**
 * Resolves the browser session with one bounded refresh/retry. It deliberately
 * preserves 403 and upstream availability states so callers do not turn them
 * into a misleading login redirect.
 */
export async function loadSessionResult(): Promise<SessionLoadResult> {
  const tokens = await readSessionTokens();
  if (!tokens) return { session: null, status: 401 };

  let access = tokens.access;
  let refreshedTokens: SessionTokens | undefined;

  if (!access) {
    if (!tokens.refresh) return { session: null, status: 401 };
    const refreshed = await refreshTokensResult(tokens.refresh);
    if (!refreshed.tokens) return refreshFailureResult(refreshed);
    refreshedTokens = refreshed.tokens;
    access = refreshed.tokens.access;
  }

  let me = await backendCurrentUser(access);
  if (me.status === 401 && tokens.refresh && !refreshedTokens) {
    const refreshed = await refreshTokensResult(tokens.refresh);
    if (!refreshed.tokens) return refreshFailureResult(refreshed);
    refreshedTokens = refreshed.tokens;
    me = await backendCurrentUser(refreshed.tokens.access);
  }

  if (!me.ok) {
    return {
      session: null,
      status: me.status,
      refreshedTokens,
      upstreamRequestId: me.upstreamRequestId,
      retryAfter: me.response.headers.get("retry-after"),
    };
  }

  const session = sessionFromUser(unwrapEnvelope(me.data));
  return {
    session,
    status: session ? 200 : 403,
    refreshedTokens,
    upstreamRequestId: me.upstreamRequestId,
  };
}

export async function loadSession(): Promise<DashboardSession | null> {
  return (await loadSessionResult()).session;
}

