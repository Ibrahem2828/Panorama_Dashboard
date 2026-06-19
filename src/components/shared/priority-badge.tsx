import { StatusBadge } from "@/components/shared/status-badge";

export function PriorityBadge({ priority }: { priority?: string | null }) {
  return <StatusBadge status={priority || "normal"} />;
}
