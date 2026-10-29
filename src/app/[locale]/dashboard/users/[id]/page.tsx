"use client";

import { notFound, useParams } from "next/navigation";

import { UserProfilePage } from "@/features/users/user-profile-page";
import { parseUserId } from "@/features/users/user-profile-rules";

export default function Page() {
  const userId = parseUserId(useParams<{ id: string }>()?.id);
  return userId === null ? notFound() : <UserProfilePage userId={userId} />;
}
