export interface DashboardStats {
  users?: {
    total?: number;
    students?: number;
    normal_users?: number;
    verified_students?: number;
    pending_verifications?: number;
  };
  printing?: {
    total_orders?: number;
    today_orders?: number;
    pending_orders?: number;
    ready_orders?: number;
    delivered_orders?: number;
  };
  groups?: {
    total?: number;
    active?: number;
    pending_join_requests?: number;
  };
  files?: {
    total?: number;
    active?: number;
  };
  support?: {
    open_tickets?: number;
    urgent_tickets?: number;
  };
}
