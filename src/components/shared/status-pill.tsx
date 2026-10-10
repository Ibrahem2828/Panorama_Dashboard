import { Badge } from "@/components/ui/badge";
import { cn, humanize } from "@/lib/utils";

const positive = new Set(["active", "approved", "ready", "completed", "published", "healthy", "success", "open", "enabled"]);
const negative = new Set(["inactive", "rejected", "failed", "cancelled", "blocked", "deleted", "unhealthy", "disabled"]);
const warning = new Set(["pending", "queued", "processing", "needs_update", "maintenance", "draft", "in_progress"]);

export function StatusPill({ value, label }: { value: unknown; label?: string }) {
  const status = String(value ?? "unknown").toLowerCase();
  return (
    <Badge
      variant="outline"
      className={cn(
        "whitespace-nowrap rounded-full px-2.5 py-1 font-semibold",
        positive.has(status) && "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        negative.has(status) && "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
        warning.has(status) && "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      )}
    >
      <span className="me-1.5 size-1.5 rounded-full bg-current" />
      {label ?? humanize(status)}
    </Badge>
  );
}
