export interface Announcement {
  id: number;
  title: string;
  description?: string;
  image?: string;
  image_url?: string;
  link?: string;
  target_user_type: string;
  target_university?: unknown;
  target_faculty?: unknown;
  target_major?: unknown;
  target_academic_year?: unknown;
  target_semester?: unknown;
  starts_at?: string;
  ends_at?: string;
  is_active?: boolean;
  created_by?: unknown;
}

export interface AnnouncementFormValues {
  title: string;
  description?: string;
  image?: File | null;
  link?: string;
  target_user_type: string;
  target_university?: string;
  target_faculty?: string;
  target_major?: string;
  target_academic_year?: string;
  target_semester?: string;
  starts_at?: string;
  ends_at?: string;
  is_active: boolean;
}
