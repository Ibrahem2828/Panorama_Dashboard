import axios, { type AxiosError } from "axios";

import type { ApiErrorResponse, FrontendApiError } from "@/types/api";

export class AppApiError extends Error implements FrontendApiError {
  errors?: Record<string, string[] | string>;
  status?: number;
  request_id?: string;

  constructor({ message, errors, status, request_id }: FrontendApiError) {
    super(message);
    this.name = "AppApiError";
    this.errors = errors;
    this.status = status;
    this.request_id = request_id;
  }
}

export function normalizeApiError(error: unknown): FrontendApiError {
  if (error instanceof AppApiError) {
    return {
      message: error.message,
      errors: error.errors,
      status: error.status,
      request_id: error.request_id,
    };
  }

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    const data = axiosError.response?.data;
    const requestId = getRequestId(data?.request_id ?? axiosError.response?.headers?.["x-request-id"]);

    if (data?.message) {
      return {
        message: data.message,
        errors: data.errors,
        status: axiosError.response?.status,
        request_id: requestId,
      };
    }

    if (axiosError.response?.status === 403) {
      return { message: "You do not have permission to perform this action.", status: 403, request_id: requestId };
    }

    if (axiosError.response?.status === 404) {
      return { message: "The requested resource was not found.", status: 404, request_id: requestId };
    }

    if (axiosError.code === "ERR_NETWORK") {
      return { message: "Unable to reach the Panorama API. Check the backend server and network connection." };
    }

    return {
      message: axiosError.message || "Request failed.",
      status: axiosError.response?.status,
      request_id: requestId,
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return { message: "An unexpected error occurred." };
}

export function toAppApiError(error: unknown) {
  return new AppApiError(normalizeApiError(error));
}

function getRequestId(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
}
