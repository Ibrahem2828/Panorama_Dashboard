"use client";

import { Bell, CheckCheck } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  useNotificationActions,
  useNotifications,
  useUnreadNotificationCount,
} from "@/features/notifications/hooks";
import { formatDate } from "@/features/academic/components/helpers";
import { listData } from "@/lib/api/crud";
import { normalizeApiError } from "@/lib/api/errors";

export default function NotificationsPage() {
  const notificationsQuery = useNotifications();
  const unreadQuery = useUnreadNotificationCount();
  const actionMutation = useNotificationActions();
  const notifications = listData(notificationsQuery.data);

  if (notificationsQuery.isLoading) {
    return <LoadingState />;
  }

  if (notificationsQuery.error) {
    const normalized = normalizeApiError(notificationsQuery.error);
    return (
      <ErrorState
        message={normalized.message}
        requestId={normalized.request_id}
        onRetry={() => notificationsQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={`Unread: ${unreadQuery.data ?? 0} — Operational alerts for dashboard users.`}
      />
      {notifications.length ? (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => actionMutation.mutate({ type: "read-all" })}
              disabled={actionMutation.isPending}
            >
              <CheckCheck />
              Mark all read
            </Button>
          </div>
          <div className="divide-y rounded-lg border bg-card">
            {notifications.map((notification) => (
              <div key={notification.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{notification.title ?? "Notification"}</p>
                    <StatusBadge status={notification.is_read ? "read" : "unread"} />
                    {notification.type ? <StatusBadge status={notification.type} /> : null}
                  </div>
                  {notification.body ? <p className="text-sm text-muted-foreground">{notification.body}</p> : null}
                  <p className="text-xs text-muted-foreground">{formatDate(notification.created_at)}</p>
                </div>
                {!notification.is_read ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => actionMutation.mutate({ type: "mark-read", id: notification.id })}
                    disabled={actionMutation.isPending}
                  >
                    Mark read
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          title="No notifications"
          description="Operational notifications and alerts will appear here."
          action={<Button disabled variant="outline"><Bell />No unread items</Button>}
        />
      )}
    </div>
  );
}
