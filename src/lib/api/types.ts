export type {
  ApiErrorResponse,
  ApiResponse,
  ApiSuccessResponse,
  FrontendApiError,
  PaginatedResponse,
} from "@/types/api";

export interface PreviewTokenResponse {
  url?: string;
  preview_url?: string;
  protected_url?: string;
  expires_at?: string;
  expires_in?: number;
}
