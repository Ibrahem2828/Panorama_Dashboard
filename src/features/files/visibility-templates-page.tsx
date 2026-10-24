"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CapabilityGate } from "@/components/feedback/capability-gate";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { FILE_VISIBILITIES } from "@/features/files/files-page";
import { useVisibilityTemplates, type VisibilityTemplate } from "@/features/files/bulk-upload";
import { useMutationError } from "@/hooks/use-idempotency-key";
import { useI18n } from "@/i18n/provider";
import { apiFetch, normalizeCollection } from "@/lib/api/browser-client";
import { CAPABILITIES } from "@/lib/auth/capabilities";

interface Option { id: number; name: string }
const NONE = "none";

function useOptions(key: string, path: string | null) {
  return useQuery({
    queryKey: ["vt-options", key, path],
    enabled: path !== null,
    queryFn: async () => normalizeCollection<Option>(await apiFetch(`${path}${path?.includes("?") ? "&" : "?"}page_size=200`)).then((page) => page.results),
  });
}

/** Saved audiences for uploads: a visibility plus the academic scope (and group) a file gets, picked in one click when uploading. */
export function VisibilityTemplatesPage() {
  const { t, enumLabel } = useI18n();
  const queryClient = useQueryClient();
  const templates = useVisibilityTemplates();
  const [editing, setEditing] = useState<VisibilityTemplate | "new" | null>(null);
  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/v1/dashboard/file-visibility-templates/${id}/`, { method: "DELETE" }),
    onSuccess: async () => { toast.success(t("common.success")); await queryClient.invalidateQueries({ queryKey: ["file-visibility-templates"] }); },
    onError: () => toast.error(t("staff.actionFailed")),
  });
  return (
    <CapabilityGate capability={CAPABILITIES.files}>
      <PageHeader title={t("files.templates.title")} description={t("files.templates.subtitle")} actions={<Button onClick={() => setEditing("new")}><Plus className="size-4" />{t("files.templates.new")}</Button>} />
      {templates.isLoading ? <Skeleton className="h-48 w-full rounded-2xl" /> : templates.isError ? <ErrorPanel error={templates.error} retry={() => void templates.refetch()} /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.data?.results.length === 0 ? <p className="text-sm text-muted-foreground">{t("files.templates.empty")}</p> : null}
          {templates.data?.results.map((template) => (
            <Card key={template.id} className={template.is_active ? "" : "opacity-60"}>
              <CardHeader className="pb-2"><CardTitle className="flex items-center justify-between text-base"><span>{template.name}</span><Badge variant="secondary">{enumLabel(template.visibility)}</Badge></CardTitle></CardHeader>
              <CardContent className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(template)}><Pencil className="size-4" />{t("common.edit")}</Button>
                <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(t("files.templates.confirmDelete"))) remove.mutate(template.id); }}><Trash2 className="size-4" />{t("common.delete")}</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {editing ? <TemplateDialog template={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </CapabilityGate>
  );
}

function Pick({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (value: string) => void; options: Option[] | undefined; disabled?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t("files.templates.any")}</SelectItem>
          {(options ?? []).map((option) => <SelectItem key={option.id} value={String(option.id)}>{option.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function TemplateDialog({ template, onClose }: { template: VisibilityTemplate | null; onClose: () => void }) {
  const { t, enumLabel } = useI18n();
  const queryClient = useQueryClient();
  const val = (value: number | null | undefined) => (value === null || value === undefined ? NONE : String(value));
  const [name, setName] = useState(template?.name ?? "");
  const [visibility, setVisibility] = useState(template?.visibility ?? "verified_students_only");
  const [university, setUniversity] = useState(val(template?.university));
  const [faculty, setFaculty] = useState(val(template?.faculty));
  const [major, setMajor] = useState(val(template?.major));
  const [year, setYear] = useState(val(template?.academic_year));
  const [semester, setSemester] = useState(val(template?.semester));
  const [subject, setSubject] = useState(val(template?.subject));
  const [group, setGroup] = useState(val(template?.group));
  const [printable, setPrintable] = useState(template?.is_printable ?? true);
  const [active, setActive] = useState(template?.is_active ?? true);
  const onError = useMutationError();

  const universities = useOptions("universities", "/api/v1/universities/");
  const faculties = useOptions("faculties", university !== NONE ? `/api/v1/universities/${university}/faculties/` : null);
  const majors = useOptions("majors", faculty !== NONE ? `/api/v1/faculties/${faculty}/majors/` : null);
  const subjects = useOptions("subjects", faculty !== NONE ? `/api/v1/faculties/${faculty}/subjects/` : null);
  const years = useOptions("years", "/api/v1/academic-years/");
  const semesters = useOptions("semesters", "/api/v1/semesters/");
  const groups = useOptions("groups", "/api/v1/dashboard/groups/?ordering=name");

  const id = (value: string) => (value === NONE ? null : Number(value));
  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), visibility, university: id(university), faculty: id(faculty), major: id(major), academic_year: id(year), semester: id(semester), subject: id(subject), group: id(group), is_printable: printable, is_active: active };
      return template
        ? apiFetch(`/api/v1/dashboard/file-visibility-templates/${template.id}/`, { method: "PATCH", body })
        : apiFetch("/api/v1/dashboard/file-visibility-templates/", { method: "POST", body });
    },
    onSuccess: async () => { toast.success(t("common.success")); await queryClient.invalidateQueries({ queryKey: ["file-visibility-templates"] }); onClose(); },
    onError,
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !save.isPending) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{template ? t("files.templates.edit") : t("files.templates.new")}</DialogTitle><DialogDescription>{t("files.templates.hint")}</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (name.trim() && !save.isPending) save.mutate(); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="vt-name">{t("files.templates.name")}</Label><Input id="vt-name" autoFocus value={name} maxLength={120} onChange={(event) => setName(event.target.value)} /></div>
            <div className="space-y-2">
              <Label>{t("field.visibility")}</Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FILE_VISIBILITIES.map((value) => <SelectItem key={value} value={value}>{enumLabel(value)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Pick label={t("field.university")} value={university} onChange={(value) => { setUniversity(value); setFaculty(NONE); setMajor(NONE); setSubject(NONE); }} options={universities.data} />
            <Pick label={t("field.faculty")} value={faculty} onChange={(value) => { setFaculty(value); setMajor(NONE); setSubject(NONE); }} options={faculties.data} disabled={university === NONE} />
            <Pick label={t("field.major")} value={major} onChange={setMajor} options={majors.data} disabled={faculty === NONE} />
            <Pick label={t("field.subject")} value={subject} onChange={setSubject} options={subjects.data} disabled={faculty === NONE} />
            <Pick label={t("field.academic_year")} value={year} onChange={setYear} options={years.data} />
            <Pick label={t("field.semester")} value={semester} onChange={setSemester} options={semesters.data} />
            <Pick label={t("field.group")} value={group} onChange={setGroup} options={groups.data} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border p-3"><Label htmlFor="vt-print">{t("field.is_printable")}</Label><Switch id="vt-print" checked={printable} onCheckedChange={setPrintable} /></div>
            <div className="flex items-center justify-between rounded-lg border p-3"><Label htmlFor="vt-active">{t("files.templates.active")}</Label><Switch id="vt-active" checked={active} onCheckedChange={setActive} /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={!name.trim()} isLoading={save.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
