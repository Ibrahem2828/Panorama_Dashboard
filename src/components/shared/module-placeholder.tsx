"use client";

import { ShieldAlert } from "lucide-react";

import { DisabledPlaceholderAction, EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";

type PermissionKey = keyof ReturnType<typeof usePermissions>;

interface ModulePlaceholderProps {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  actionLabel?: string;
  permission: PermissionKey;
}

export function ModulePlaceholder({
  title,
  description,
  emptyTitle,
  emptyDescription,
  actionLabel = "Available in Phase 2",
  permission,
}: ModulePlaceholderProps) {
  const permissions = usePermissions();

  if (!permissions[permission]) {
    return (
      <div className="space-y-6">
        <PageHeader title="Access restricted" description="Your role cannot access this dashboard area." />
        <EmptyState
          title="403 - Permission required"
          description="The backend remains the source of truth, and this dashboard hides restricted tools based on your role."
          action={
            <Button disabled variant="outline">
              <ShieldAlert className="size-4" />
              Restricted
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} actionLabel={actionLabel} />
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={<DisabledPlaceholderAction label={actionLabel} />}
      />
    </div>
  );
}
