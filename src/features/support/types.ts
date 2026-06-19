export interface SupportTicket {
  id: number | string;
  user?: unknown;
  category?: string;
  subject?: string;
  status: string;
  priority?: string;
  assigned_to?: unknown;
  created_at?: string;
  messages?: SupportMessage[];
  attachments?: unknown[];
}
export interface SupportMessage {
  id?: number;
  sender?: unknown;
  message?: string;
  body?: string;
  created_at?: string;
}
