import { Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-8 text-center", className)}>
      <div className="mb-4 rounded-full bg-primary/10 p-3">
        <Inbox className="size-6 text-primary" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function DisabledPlaceholderAction({ label }: { label: string }) {
  return (
    <Button disabled variant="outline">
      {label}
    </Button>
  );
}
