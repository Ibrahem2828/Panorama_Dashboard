"use client";

import { AlertTriangle, Braces, CheckCircle2, FileWarning, ShieldCheck } from "lucide-react";

import { CapabilityGate } from "@/components/feedback/capability-gate";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/messages";

export function ContractGapPage({ titleKey, subtitleKey, missingOperations, existingOperations }: {
  titleKey: MessageKey;
  subtitleKey: MessageKey;
  missingOperations: string[];
  existingOperations: string[];
}) {
  const { t } = useI18n();
  return (
    <CapabilityGate capability={CAPABILITIES.product}>
      <div className="space-y-6">
        <PageHeader title={t(titleKey)} description={t(subtitleKey)} eyebrow="Contract readiness" />
        <Card className="overflow-hidden border-amber-500/30">
          <div className="h-1 bg-amber-500" />
          <CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl bg-amber-500/15 p-3 text-amber-700 dark:text-amber-300"><AlertTriangle className="size-6" /></div>
              <div className="min-w-0 flex-1"><CardTitle>{t("product.contractMissing")}</CardTitle><CardDescription>This screen intentionally does not call a mobile self-service endpoint as an administrative API.</CardDescription></div>
              <Badge variant="outline" className="border-amber-500/40">Backend contract required</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border bg-muted/25 p-4">
              <h3 className="flex items-center gap-2 font-bold"><CheckCircle2 className="size-4 text-emerald-500" />Available mobile operations</h3>
              <ul className="mt-3 space-y-2 font-mono text-xs text-muted-foreground">{existingOperations.map((item) => <li key={item} className="rounded-lg bg-background p-2">{item}</li>)}</ul>
            </div>
            <div className="rounded-2xl border bg-muted/25 p-4">
              <h3 className="flex items-center gap-2 font-bold"><FileWarning className="size-4 text-amber-500" />Required dashboard operations</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">{missingOperations.map((item) => <li key={item} className="flex gap-2"><Braces className="mt-0.5 size-4 shrink-0" />{item}</li>)}</ul>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><ShieldCheck className="size-5" /></div><div><CardTitle className="text-base">Fail closed by design</CardTitle><CardDescription>The dashboard waits for a capability-protected administrative contract instead of exposing or repurposing end-user APIs.</CardDescription></div></CardHeader>
        </Card>
      </div>
    </CapabilityGate>
  );
}
