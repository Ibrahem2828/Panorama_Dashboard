"use client";

import { FileCheck2, ScrollText } from "lucide-react";

import { CapabilityGate } from "@/components/feedback/capability-gate";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResourceManager } from "@/features/resources/resource-manager";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { useI18n } from "@/i18n/provider";

export function PoliciesPage() {
  const { t } = useI18n();
  return (
    <CapabilityGate capability={CAPABILITIES.product}>
      <div className="space-y-6">
        <PageHeader title={t("governance.policies.title")} description={t("governance.policies.subtitle")} eyebrow="Governance" />
        <Tabs defaultValue="privacy" className="space-y-4">
          <TabsList><TabsTrigger value="privacy"><FileCheck2 />{t("governance.privacy")}</TabsTrigger><TabsTrigger value="terms"><ScrollText />{t("governance.terms")}</TabsTrigger></TabsList>
          <TabsContent value="privacy"><ResourceManager resourceKey="privacy-policy-versions" title={t("governance.privacyVersions")} capability={CAPABILITIES.product} /></TabsContent>
          <TabsContent value="terms"><ResourceManager resourceKey="terms-versions" title={t("governance.termsVersions")} capability={CAPABILITIES.product} /></TabsContent>
        </Tabs>
      </div>
    </CapabilityGate>
  );
}
