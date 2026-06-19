import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/formatters";

const visibilityVariant: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"> = {
  public: "success",
  students_only: "info",
  verified_students_only: "info",
  major_only: "warning",
  group_only: "warning",
  admin_only: "secondary",
};

export function VisibilityBadge({ visibility }: { visibility: string }) {
  const variant = visibilityVariant[visibility] ?? "outline";
  return <Badge variant={variant}>{titleCase(visibility)}</Badge>;
}
