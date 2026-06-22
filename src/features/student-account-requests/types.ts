export type StudentAccountRequestStatus =
  | "pending_review"
  | "approved_pending_otp"
  | "otp_sent"
  | "active"
  | "rejected"
  | "needs_update"
  | "expired";

export interface AcademicRelation {
  id: number;
  name: string;
}

export interface StudentAccountRequestListItem {
  id: number;
  public_id?: string;
  full_name?: string;
  email?: string;
  phone_number?: string;
  whatsapp_phone?: string;
  university?: number | AcademicRelation;
  university_detail?: AcademicRelation;
  faculty?: number | AcademicRelation;
  faculty_detail?: AcademicRelation;
  major?: number | AcademicRelation;
  major_detail?: AcademicRelation;
  student_number?: string;
  status: StudentAccountRequestStatus | string;
  created_at?: string;
  reviewed_at?: string;
  approved_at?: string;
  activated_at?: string;
  updated_at?: string;
}

export interface StudentAccountRequestDetail extends StudentAccountRequestListItem {
  admin_note?: string;
  rejection_reason?: string;
  needs_update_reason?: string;
  reviewed_by?: number;
  reviewed_by_name?: string;
  created_user_id?: number;
  otp_expires_at?: string;
  otp_last_sent_at?: string;
  otp_verified_at?: string;
  has_uploaded_card?: boolean;
  academic_year?: number | AcademicRelation;
  academic_year_detail?: AcademicRelation;
}

export interface StudentAccountRequestOtpPayload {
  request_id?: string;
  status?: string;
  otp_code?: string;
  otp_expires_at?: string;
  resend_after_seconds?: number;
  whatsapp_phone?: string;
  manual_whatsapp_message?: string;
  detail?: StudentAccountRequestDetail;
}

export interface RejectPayload {
  rejection_reason: string;
  admin_note?: string;
}

export interface NeedsUpdatePayload {
  needs_update_reason: string;
  admin_note?: string;
}