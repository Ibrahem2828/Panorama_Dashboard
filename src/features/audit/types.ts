export interface AuditLog {
  id: number;
  actor?: unknown;
  action?: string;
  target_type?: string;
  target_id?: string | number;
  ip_address?: string;
  user_agent?: string;
  old_value?: unknown;
  new_value?: unknown;
  created_at?: string;
}
