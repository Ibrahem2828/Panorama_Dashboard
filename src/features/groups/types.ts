import type { User } from "@/types/auth";

export interface Group {
  id: number;
  name: string;
  description?: string;
  image?: string;
  image_url?: string;
  university?: unknown;
  faculty?: unknown;
  major?: unknown;
  academic_year?: unknown;
  semester?: unknown;
  subject?: unknown;
  requires_approval?: boolean;
  send_messages_permission?: "all_members" | "admins_only";
  members_count?: number;
  is_active?: boolean;
  created_at?: string;
}

export interface GroupMembership {
  id: number;
  user?: User;
  role?: "member" | "moderator" | "group_admin";
  status?: string;
  joined_at?: string;
}

export interface GroupFormValues {
  name: string;
  description?: string;
  image?: File | null;
  university?: string;
  faculty?: string;
  major?: string;
  academic_year?: string;
  semester?: string;
  subject?: string;
  requires_approval: boolean;
  send_messages_permission: "all_members" | "admins_only";
  is_active: boolean;
}
