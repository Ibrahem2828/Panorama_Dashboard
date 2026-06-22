"use client";

import { useParams } from "next/navigation";

import { StudentAccountRequestDetailPage } from "@/features/student-account-requests/components/student-account-request-detail-page";

export default function StudentAccountRequestDetailRoutePage() {
  const params = useParams<{ id: string }>();
  const requestId = params.id;

  if (!requestId) {
    return null;
  }

  return <StudentAccountRequestDetailPage requestId={requestId} />;
}