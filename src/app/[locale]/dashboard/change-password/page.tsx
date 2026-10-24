"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ChangePasswordForm } from "@/features/auth/public-auth";
import { useI18n } from "@/i18n/provider";

export default function ChangePasswordPage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader title={t("publicAuth.changePassword")} description={t("publicAuth.changeSubtitle")} />
      <Card><CardContent className="p-6"><ChangePasswordForm forced /></CardContent></Card>
    </div>
  );
}
