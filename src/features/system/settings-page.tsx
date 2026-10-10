"use client";

import { Laptop, Moon, Sparkles, Sun, TableProperties } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect } from "react";

import { CapabilityGate } from "@/components/feedback/capability-gate";
import { LanguageSwitcher } from "@/components/navigation/language-switcher";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { usePreferences } from "@/features/preferences";
import { useI18n } from "@/i18n/provider";

export function SettingsPage() {
  const { t } = useI18n();
  const { setTheme, theme } = useTheme();
  const { density, setDensity, reduceMotion, setReduceMotion } = usePreferences();

  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
  }, [reduceMotion]);

  return (
    <CapabilityGate capability={CAPABILITIES.dashboard}>
      <div className="space-y-6">
        <PageHeader title={t("settings.title")} description={t("settings.subtitle")} eyebrow="Personal workspace" />
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>{t("settings.appearance")}</CardTitle><CardDescription>{t("common.theme")}</CardDescription></CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              {[
                { key: "light", label: t("common.light"), icon: Sun },
                { key: "dark", label: t("common.dark"), icon: Moon },
                { key: "system", label: t("common.system"), icon: Laptop },
              ].map(({ key, label, icon: Icon }) => (
                <Button key={key} variant={theme === key ? "default" : "outline"} className="h-24 flex-col gap-2" onClick={() => setTheme(key)}><Icon className="size-5" />{label}</Button>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t("common.language")}</CardTitle><CardDescription>{t("settings.localeNote")}</CardDescription></CardHeader>
            <CardContent><div className="flex items-center justify-between rounded-xl border p-4"><span className="font-semibold">العربية / English</span><LanguageSwitcher /></div></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t("settings.interface")}</CardTitle><CardDescription>{t("settings.density")}</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Button variant={density === "comfortable" ? "default" : "outline"} className="h-20 flex-col" onClick={() => setDensity("comfortable")}><TableProperties />{t("settings.comfortable")}</Button>
                <Button variant={density === "compact" ? "default" : "outline"} className="h-20 flex-col" onClick={() => setDensity("compact")}><TableProperties />{t("settings.compact")}</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t("settings.reduceMotion")}</CardTitle><CardDescription>Accessibility preference stored locally; no sensitive data is persisted.</CardDescription></CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-xl border p-4">
                <Label htmlFor="reduce-motion" className="flex items-center gap-2"><Sparkles className="size-4" />{t("settings.reduceMotion")}</Label>
                <Switch id="reduce-motion" checked={reduceMotion} onCheckedChange={setReduceMotion} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </CapabilityGate>
  );
}
