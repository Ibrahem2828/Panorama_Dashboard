"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button, type ButtonProps } from "@/components/ui/button";
import { openProtectedPreview } from "@/lib/api/protected-media";
import { normalizeApiError } from "@/lib/api/errors";
import type { PreviewTokenResponse } from "@/lib/api/types";

interface ProtectedMediaButtonProps extends Omit<ButtonProps, "onClick"> {
  getPreviewToken: () => Promise<PreviewTokenResponse>;
  label?: string;
  formatError?: (error: unknown) => string;
}

export function ProtectedMediaButton({
  getPreviewToken,
  label = "Open preview",
  formatError,
  children,
  disabled,
  variant = "outline",
  size = "sm",
  ...props
}: ProtectedMediaButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleOpenPreview() {
    setLoading(true);
    try {
      await openProtectedPreview(getPreviewToken);
    } catch (error) {
      const normalized = normalizeApiError(error);
      const message = formatError ? formatError(error) : normalized.message;
      toast.error(message, {
        description: normalized.request_id ? `Request ID: ${normalized.request_id}` : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled}
      isLoading={loading}
      onClick={handleOpenPreview}
      {...props}
    >
      <ExternalLink />
      {children ?? label}
    </Button>
  );
}
