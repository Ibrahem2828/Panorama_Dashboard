"use client";

import { ShieldX } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/i18n/provider";

export function AccessDenied() {
  const { t } = useI18n();
  return (
    <Card className="mx-auto max-w-xl border-primary/15">
      <CardContent className="flex flex-col items-center p-10 text-center">
        <div className="grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary"><ShieldX className="size-8" /></div>
        <h2 className="mt-5 text-xl font-bold">403</h2>
        <p className="mt-2 text-muted-foreground">{t("common.noPermission")}</p>
      </CardContent>
    </Card>
  );
}
