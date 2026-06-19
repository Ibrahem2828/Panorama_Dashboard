import type { User } from "@/types/auth";

export interface VerificationRequest {
  id: number;
  user?: User;
  student?: User;
  full_name?: string;
  email?: string;
  phone_number?: string;
  phone?: string;
  student_number?: string;
  detected_faculty_code?: string;
  detected_faculty_name?: string;
  enrollment_year?: string;
  serial_number?: string;
  university?: { id: number; name: string } | string;
  faculty?: { id: number; name: string } | string;
  selected_faculty?: { id: number; name: string } | string;
  major?: { id: number; name: string } | string;
  academic_year?: { id: number; name: string } | string;
  semester?: { id: number; name: string } | string;
  card_image?: string;
  card_image_url?: string;
  status: string;
  created_at?: string;
}

export interface VerificationDecision {
  rejection_reason?: string;
  admin_note?: string;
}
