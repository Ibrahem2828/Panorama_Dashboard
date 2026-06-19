export interface PrintOrder {
  id: number | string;
  user?: unknown;
  phone?: string;
  role?: string;
  priority?: string;
  status: string;
  items?: PrintOrderItem[];
  items_count?: number;
  total_price?: string | number;
  assigned_to?: unknown;
  user_notes?: string;
  internal_notes?: string;
  created_at?: string;
  completed_at?: string;
  status_history?: PrintStatusHistory[];
}
export interface PrintOrderItem {
  id?: number;
  file_name?: string;
  file?: string;
  uploaded_file?: string;
  source_file?: string;
  copies?: number;
  color_mode?: string;
  paper_size?: string;
  sides?: string;
  binding?: string;
  pages_count?: number;
  price?: string | number;
}
export interface PrintStatusHistory {
  id?: number;
  old_status?: string;
  new_status?: string;
  changed_by?: unknown;
  note?: string;
  created_at?: string;
}
