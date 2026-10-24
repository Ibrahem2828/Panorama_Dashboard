"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CapabilityGate } from "@/components/feedback/capability-gate";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useCapabilityLabel, useTemplates, type PermissionTemplate } from "@/features/users/staff-onboarding";
import { useMutationError } from "@/hooks/use-idempotency-key";
import { useI18n } from "@/i18n/provider";
import { apiFetch } from "@/lib/api/browser-client";
import { CAPABILITIES } from "@/lib/auth/capabilities";

const STAFF_ROLES = ["admin", "print_staff", "support_staff", "content_manager"] as const;
/** Mirrors DANGEROUS_CAPABILITIES in the backend (the server enforces the confirmation either way). */
const DANGEROUS = new Set<string>([CAPABILITIES.system, CAPABILITIES.users, CAPABILITIES.finance, CAPABILITIES.audit]);
const GRANTABLE = Object.values(CAPABILITIES).filter((code) => code !== CAPABILITIES.system);

/** Permission templates: the named bundles used when adding staff. System templates can be edited or switched off, never deleted. */
export function PermissionTemplatesPage() {
  const { t, locale } = useI18n();
  const capabilityLabel = useCapabilityLabel();
  const queryClient = useQueryClient();
  const templates = useTemplates();
  const [editing, setEditing] = useState<PermissionTemplate | "new" | null>(null);
  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/v1/dashboard/permission-templates/${id}/`, { method: "DELETE" }),
    onSuccess: async () => { toast.success(t("common.success")); await queryClient.invalidateQueries({ queryKey: ["permission-templates"] }); },
    onError: () => toast.error(t("staff.actionFailed")),
  });

  return (
    <CapabilityGate capability={CAPABILITIES.users}>
      <PageHeader title={t("staff.templatesTitle")} description={t("staff.templatesSubtitle")} actions={<Button onClick={() => setEditing("new")}><Plus className="size-4" />{t("staff.newTemplate")}</Button>} />
      {templates.isLoading ? <Skeleton className="h-64 w-full rounded-2xl" /> : templates.isError ? <ErrorPanel error={templates.error} retry={() => void templates.refetch()} /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.data?.results.map((template) => (
            <Card key={template.id} className={template.is_active ? "" : "opacity-60"}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span>{locale === "ar" ? template.name_ar : template.name_en}</span>
                  <span className="flex gap-1">{template.is_system ? <Badge variant="secondary">{t("staff.system")}</Badge> : null}{template.is_active ? null : <Badge variant="outline">{t("staff.off")}</Badge>}</span>
                </CardTitle>
                <CardDescription>{template.description || t(`roles.${template.role}` as "roles.admin")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1">{template.capabilities.map((code) => <Badge key={code} variant={DANGEROUS.has(code) ? "destructive" : "outline"}>{capabilityLabel(code)}</Badge>)}</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(template)}><Pencil className="size-4" />{t("common.edit")}</Button>
                  {template.is_system ? null : <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(t("staff.confirmDeleteTemplate"))) remove.mutate(template.id); }}><Trash2 className="size-4" />{t("common.delete")}</Button>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {editing ? <TemplateDialog template={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </CapabilityGate>
  );
}

function TemplateDialog({ template, onClose }: { template: PermissionTemplate | null; onClose: () => void }) {
  const { t } = useI18n();
  const capabilityLabel = useCapabilityLabel();
  const queryClient = useQueryClient();
  const [key, setKey] = useState(template?.key ?? "");
  const [nameAr, setNameAr] = useState(template?.name_ar ?? "");
  const [nameEn, setNameEn] = useState(template?.name_en ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [role, setRole] = useState(template?.role ?? "support_staff");
  const [capabilities, setCapabilities] = useState<Set<string>>(new Set(template?.capabilities ?? [CAPABILITIES.dashboard]));
  const [active, setActive] = useState(template?.is_active ?? true);
  const [confirmed, setConfirmed] = useState(false);
  const keyError = useMutationError();
  const dangerous = [...capabilities].filter((code) => DANGEROUS.has(code));
  const valid = nameAr.trim() && nameEn.trim() && (template ? true : /^[a-z0-9_-]{2,40}$/u.test(key)) && capabilities.size > 0 && (dangerous.length === 0 || confirmed);

  const save = useMutation({
    mutationFn: () => {
      const body = { key: template ? undefined : key, name_ar: nameAr.trim(), name_en: nameEn.trim(), description: description.trim(), role, capabilities: [...capabilities], is_active: active, confirm_dangerous: confirmed };
      return template
        ? apiFetch(`/api/v1/dashboard/permission-templates/${template.id}/`, { method: "PATCH", body })
        : apiFetch("/api/v1/dashboard/permission-templates/", { method: "POST", body });
    },
    onSuccess: async () => { toast.success(t("common.success")); await queryClient.invalidateQueries({ queryKey: ["permission-templates"] }); onClose(); },
    onError: keyError,
  });
  const toggle = (code: string) => setCapabilities((current) => { const next = new Set(current); if (next.has(code)) next.delete(code); else next.add(code); return next; });

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !save.isPending) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{template ? t("staff.editTemplate") : t("staff.newTemplate")}</DialogTitle><DialogDescription>{t("staff.templateHint")}</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (valid && !save.isPending) save.mutate(); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="tpl-ar">{t("staff.nameAr")}</Label><Input id="tpl-ar" value={nameAr} maxLength={80} onChange={(event) => setNameAr(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="tpl-en">{t("staff.nameEn")}</Label><Input id="tpl-en" dir="ltr" className="text-start" value={nameEn} maxLength={80} onChange={(event) => setNameEn(event.target.value)} /></div>
            {template ? null : <div className="space-y-2"><Label htmlFor="tpl-key">{t("staff.templateKey")}</Label><Input id="tpl-key" dir="ltr" className="text-start" value={key} maxLength={40} onChange={(event) => setKey(event.target.value.toLowerCase())} /></div>}
            <div className="space-y-2">
              <Label>{t("staff.baseRole")}</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STAFF_ROLES.map((value) => <SelectItem key={value} value={value}>{t(`roles.${value}` as "roles.admin")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label htmlFor="tpl-desc">{t("staff.description")}</Label><Input id="tpl-desc" value={description} maxLength={255} onChange={(event) => setDescription(event.target.value)} /></div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("staff.permissions")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {GRANTABLE.map((code) => (
                <label key={code} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm ${DANGEROUS.has(code) ? "border-destructive/40" : ""}`}>
                  <input type="checkbox" checked={capabilities.has(code)} onChange={() => toggle(code)} />
                  <span>{capabilityLabel(code)}</span>
                  {DANGEROUS.has(code) ? <AlertTriangle className="ms-auto size-3.5 text-destructive" aria-label={t("staff.dangerousMark")} /> : null}
                </label>
              ))}
            </div>
          </fieldset>
          {dangerous.length > 0 ? (
            <label className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <input type="checkbox" className="mt-1" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
              <span><span className="font-semibold">{t("staff.dangerousTitle")}</span><span className="block text-xs">{t("staff.dangerousConfirm", { list: dangerous.map(capabilityLabel).join("، ") })}</span></span>
            </label>
          ) : null}
          <div className="flex items-center justify-between rounded-lg border p-3"><Label htmlFor="tpl-active">{t("staff.templateActive")}</Label><Switch id="tpl-active" checked={active} onCheckedChange={setActive} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={!valid} isLoading={save.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
