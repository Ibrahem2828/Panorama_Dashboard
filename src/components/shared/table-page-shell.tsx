"use client";

import { Plus } from "lucide-react";

import { ErrorState } from "@/components/feedback/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { normalizeApiError } from "@/lib/api/errors";

interface TablePageShellProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  error?: unknown;
  onRetry?: () => void;
  children: React.ReactNode;
}

export function TablePageShell({ title, description, actionLabel, onAction, error, onRetry, children }: TablePageShellProps) {
  if (error) {
    const normalized = normalizeApiError(error);
    return (
      <div className="space-y-6">
        <PageHeader title={title} description={description} />
        <ErrorState message={normalized.message} requestId={normalized.request_id} onRetry={onRetry} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      {actionLabel ? (
        <div className="flex justify-end">
          <Button onClick={onAction}>
            <Plus />
            {actionLabel}
          </Button>
        </div>
      ) : null}
      {children}
    </div>
  );
}
