export interface FileRecord {
  id: number;
  title: string;
  description?: string;
  file?: string;
  file_url?: string;
  file_type?: string;
  visibility: string;
  university?: unknown;
  faculty?: unknown;
  major?: unknown;
  academic_year?: unknown;
  semester?: unknown;
  subject?: unknown;
  group?: unknown;
  is_printable?: boolean;
  is_active?: boolean;
  uploaded_by?: unknown;
  created_at?: string;
}

export interface FileFormValues {
  title: string;
  description?: string;
  file?: File | null;
  visibility: string;
  university?: string;
  faculty?: string;
  major?: string;
  academic_year?: string;
  semester?: string;
  subject?: string;
  group?: string;
  is_printable: boolean;
  is_active: boolean;
}
