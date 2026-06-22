import { Badge } from "@/components/ui/badge";
import { getStatusLabel } from "@/features/student-account-requests/constants";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"> = {
  pending_review: "warning",
  approved_pending_otp: "info",
  otp_sent: "info",
  active: "success",
  rejected: "destructive",
  needs_update: "warning",
  expired: "outline",
};

export function StudentAccountRequestStatusBadge({ status }: { status: string }) {
  return <Badge variant={statusVariant[status] ?? "outline"}>{getStatusLabel(status)}</Badge>;
}