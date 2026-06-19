"use client";

import { ShieldAlert } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";

interface AccessDeniedProps {
  title?: string;
  description?: string;
  showHeader?: boolean;
}

export function AccessDenied({ title = "Access denied", description = "Your role does not have permission to view this module. Contact an administrator if you believe this is an error.", showHeader = true }: AccessDeniedProps) {
  const content = (
    <EmptyState
      title={title}
      description={description}
      action={
        <Button variant="outline" disabled>
          <ShieldAlert className="size-4" />
          Restricted
        </Button>
      }
    />
  );

  if (showHeader) {
    return (
      <div className="space-y-6">
        <PageHeader title="Access restricted" description="This area is limited to authorized dashboard roles." />
        {content}
      </div>
    );
  }

  return content;
}
