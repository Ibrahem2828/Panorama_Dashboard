export type VerificationStatus =
  | "incomplete"
  | "pending"
  | "approved"
  | "rejected"
  | "needs_update"
  | "suspended";

export type PrintingStatus =
  | "submitted"
  | "under_review"
  | "accepted"
  | "printing"
  | "ready"
  | "delivered"
  | "cancelled"
  | "rejected";

export type SupportStatus = "open" | "in_progress" | "waiting_user" | "resolved" | "closed";

export type MembershipStatus = "pending" | "approved" | "rejected" | "blocked" | "left";

export type AppStatus = VerificationStatus | PrintingStatus | SupportStatus | MembershipStatus;
