import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/formatters";
import type { UserRole } from "@/types/roles";

const roleVariants: Record<UserRole, "default" | "secondary" | "outline" | "info"> = {
  it_support: "default",
  admin: "info",
  print_staff: "secondary",
  student: "outline",
  normal_user: "outline",
};

export function RoleBadge({ role }: { role: UserRole }) {
  return <Badge variant={roleVariants[role]}>{titleCase(role)}</Badge>;
}
