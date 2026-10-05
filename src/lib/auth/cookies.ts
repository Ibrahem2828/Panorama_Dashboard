import "server-only";

import { NextResponse } from "next/server";

import { serverEnv } from "@/config/env.server";
import { jwtExpiry } from "@/lib/auth/jwt";
import { newCsrfToken } from "@/lib/security/csrf";

export interface SessionTokens {
  access: string;
  refresh: string;
}

function maxAgeFromToken(token: string, fallback: number) {
  const exp = jwtExpiry(token);
  return exp ? Math.max(1, exp - Math.floor(Date.now() / 1000)) : fallback;
}

export function setSessionCookies(response: NextResponse, tokens: SessionTokens, csrfToken = newCsrfToken()) {
  const apiCookie = {
    secure: serverEnv.secureCookies,
    sameSite: "lax" as const,
    path: "/api",
  };
  response.cookies.set(serverEnv.cookieNames.access, tokens.access, {
    ...apiCookie,
    httpOnly: true,
    maxAge: maxAgeFromToken(tokens.access, 15 * 60),
  });
  response.cookies.set(serverEnv.cookieNames.refresh, tokens.refresh, {
    ...apiCookie,
    httpOnly: true,
    maxAge: maxAgeFromToken(tokens.refresh, 7 * 24 * 60 * 60),
  });
  response.cookies.set(serverEnv.cookieNames.csrf, csrfToken, {
    secure: serverEnv.secureCookies,
    sameSite: "lax",
    path: "/",
    httpOnly: false,
    maxAge: maxAgeFromToken(tokens.refresh, 7 * 24 * 60 * 60),
  });
}

export function clearSessionCookies(response: NextResponse) {
  for (const name of [serverEnv.cookieNames.access, serverEnv.cookieNames.refresh]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: serverEnv.secureCookies,
      sameSite: "lax",
      path: "/api",
      expires: new Date(0),
      maxAge: 0,
    });
  }
  response.cookies.set(serverEnv.cookieNames.csrf, "", {
    httpOnly: false,
    secure: serverEnv.secureCookies,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
}
