import axios, { AxiosError, type AxiosRequestConfig } from "axios";

import { env } from "@/config/env";
import { endpoints } from "@/lib/api/endpoints";
import { toAppApiError } from "@/lib/api/errors";
import { clearSession, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from "@/lib/auth/token-storage";
import { ROUTES } from "@/lib/routes";
import type { ApiResponse } from "@/types/api";

interface RetryableAxiosRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

let refreshPromise: Promise<string> | null = null;

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  headers: {
    Accept: "application/json",
  },
});

function redirectToLogin() {
  if (typeof window !== "undefined") {
    window.location.assign(ROUTES.login);
  }
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    const refresh = getRefreshToken();

    if (!refresh) {
      throw new Error("Missing refresh token.");
    }

    refreshPromise = axios
      .post<ApiResponse<{ access: string; refresh?: string }>>(`${env.apiBaseUrl}${endpoints.auth.refresh}`, { refresh })
      .then((response) => {
        const payload = response.data;
        if (!payload.success) {
          throw new Error(payload.message);
        }
        setAccessToken(payload.data.access);
        if (payload.data.refresh) {
          setRefreshToken(payload.data.refresh);
        }
        return payload.data.access;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  } else {
    config.headers["Content-Type"] = "application/json";
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableAxiosRequestConfig | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const access = await refreshAccessToken();
        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${access}`,
        };
        return apiClient(originalRequest);
      } catch {
        clearSession();
        redirectToLogin();
      }
    }

    return Promise.reject(toAppApiError(error));
  },
);
