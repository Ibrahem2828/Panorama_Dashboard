"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTableRowActions } from "@/components/data-table/data-table-row-actions";
import { FormFileUpload } from "@/components/forms/form-file-upload";
import { FormInput } from "@/components/forms/form-input";
import { FormSelect } from "@/components/forms/form-select";
import { FormSwitch } from "@/components/forms/form-switch";
import { FormTextarea } from "@/components/forms/form-textarea";
import { EntityDialog } from "@/components/shared/entity-dialog";
import { ProtectedMediaButton } from "@/components/shared/protected-media-button";
import { AccessDenied } from "@/components/shared/access-denied";
import { StatusBadge } from "@/components/shared/status-badge";
import { VisibilityBadge } from "@/components/shared/visibility-badge";
import { TablePageShell } from "@/components/shared/table-page-shell";
import { Button } from "@/components/ui/button";
import { useAcademicYears, useFaculties, useMajors, useSemesters, useSubjects, useUniversities } from "@/features/academic/hooks";
import { formatDate, getRelatedName } from "@/features/academic/components/helpers";
import { useGroupOptions } from "@/features/groups/hooks";
import type { FileFormValues, FileRecord } from "@/features/files/types";
import { getFilePreviewToken } from "@/features/files/api";
import { useCreateFileRecord, useDeleteFileRecord, useFiles, useUpdateFileRecord } from "@/features/files/hooks";
import { listData } from "@/lib/api/crud";
import { normalizeApiError } from "@/lib/api/errors";
import { openProtectedPreview } from "@/lib/api/protected-media";
import { readString } from "@/lib/object";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canManageFiles } from "@/lib/permissions";

const visibilityOptions = [
  { label: "Public (عام)", value: "public" },
  { label: "Students only (الطلاب فقط)", value: "students_only" },
  { label: "Verified students only (الطلاب الموثقين)", value: "verified_students_only" },
  { label: "Major only (التخصص فقط)", value: "major_only" },
  { label: "Group only (المجموعة فقط)", value: "group_only" },
  { label: "Admin only (إداري)", value: "admin_only" },
];

const schema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  file: (typeof File === "undefined" ? z.unknown() : z.instanceof(File)).nullable().optional(),
  visibility: z.string().min(1),
  university: z.string().optional(),
  faculty: z.string().optional(),
  major: z.string().optional(),
  academic_year: z.string().optional(),
  semester: z.string().optional(),
  subject: z.string().optional(),
  group: z.string().optional(),
  is_printable: z.boolean(),
  is_active: z.boolean(),
}).superRefine((values, ctx) => {
  if (values.visibility === "major_only" && (!values.major || !values.academic_year)) {
    ctx.addIssue({ code: "custom", path: ["major"], message: "Major and academic year are required for major-only files." });
  }
  if (values.visibility === "group_only" && !values.group) {
    ctx.addIssue({ code: "custom", path: ["group"], message: "Group is required for group-only files." });
  }
});

const defaults: FileFormValues = { title: "", description: "", file: null, visibility: "public", university: "", faculty: "", major: "", academic_year: "", semester: "", subject: "", group: "", is_printable: false, is_active: true };

export function FilesPage() {
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FileRecord | null>(null);
  const listQuery = useFiles();
  const createMutation = useCreateFileRecord();
  const updateMutation = useUpdateFileRecord();
  const deleteMutation = useDeleteFileRecord();
  const rows = listData(listQuery.data);

  const columns = useMemo<ColumnDef<FileRecord>[]>(() => [
    { accessorKey: "title", header: ({ column }) => <DataTableColumnHeader column={column} title="Title" /> },
    { accessorKey: "file_type", header: "Type", cell: ({ row }) => row.original.file_type ?? "-" },
    { accessorKey: "visibility", header: "Visibility", cell: ({ row }) => <VisibilityBadge visibility={row.original.visibility} /> },
    { accessorKey: "university", header: "University", cell: ({ row }) => getRelatedName(row.original.university) },
    { accessorKey: "major", header: "Major", cell: ({ row }) => getRelatedName(row.original.major) },
    { accessorKey: "academic_year", header: "Year", cell: ({ row }) => getRelatedName(row.original.academic_year) },
    { accessorKey: "subject", header: "Subject", cell: ({ row }) => getRelatedName(row.original.subject) },
    { accessorKey: "group", header: "Group", cell: ({ row }) => getRelatedName(row.original.group) },
    { accessorKey: "is_printable", header: "Printable", cell: ({ row }) => row.original.is_printable ? "Yes" : "No" },
    { accessorKey: "is_active", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.is_active === false ? "inactive" : "active"} /> },
    { accessorKey: "uploaded_by", header: "Uploaded by", cell: ({ row }) => readString(row.original, ["uploaded_by.full_name", "uploaded_by.email"]) },
    { accessorKey: "created_at", header: "Created", cell: ({ row }) => formatDate(row.original.created_at) },
    { id: "actions", cell: ({ row }) => <DataTableRowActions row={row.original} actions={[
      {
        label: "Open protected preview",
        onClick: (record) => {
          void openProtectedPreview(() => getFilePreviewToken(record.id)).catch((error) => {
            const normalized = normalizeApiError(error);
            toast.error(normalized.message, {
              description: normalized.request_id ? `Request ID: ${normalized.request_id}` : undefined,
            });
          });
        },
      },
      { label: "Edit", onClick: (record) => { setEditing(record); setOpen(true); } },
    ]} /> },
  ], []);

  if (!canManageFiles(user?.role)) {
    return <AccessDenied title="Files module restricted" description="Only it_support and admin roles may access the files library." />;
  }

  return (
    <TablePageShell title="Files Library" description="Upload and manage files, visibility, printability, and targeting." actionLabel="Upload file" onAction={() => { setEditing(null); setOpen(true); }} error={listQuery.error} onRetry={() => listQuery.refetch()}>
      <DataTable columns={columns} data={rows} loading={listQuery.isLoading} searchPlaceholder="Search files" />
      <EntityDialog<FileFormValues>
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit file" : "Upload file"}
        description="Visibility rules are enforced by backend and mirrored here for a safer workflow."
        schema={schema}
        defaultValues={editing ? valuesFromFile(editing) : defaults}
        submitLabel={editing ? "Save changes" : "Upload"}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onSubmit={async (values) => { if (editing) await updateMutation.mutateAsync({ id: editing.id, values }); else await createMutation.mutateAsync(values); }}
      >
        {(form) => <FileFormFields form={form} editing={editing} onDelete={() => deleteMutation.mutate(editing?.id ?? 0, { onSuccess: () => setOpen(false) })} />}
      </EntityDialog>
    </TablePageShell>
  );
}

function FileFormFields({ form, editing, onDelete }: { form: UseFormReturn<FileFormValues>; editing: FileRecord | null; onDelete: () => void }) {
  const visibility = form.watch("visibility");
  const university = form.watch("university");
  const faculty = form.watch("faculty");
  const major = form.watch("major");
  const universities = useUniversities();
  const faculties = useFaculties(university);
  const majors = useMajors(faculty);
  const years = useAcademicYears();
  const semesters = useSemesters();
  const subjects = useSubjects({ major });
  const groups = useGroupOptions();

  return (
    <div className="space-y-4">
      {visibility === "admin_only" ? <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">هذا الملف إداري ولن يظهر في تطبيق الطلاب.</div> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormInput control={form.control} name="title" label="Title" />
        <FormSelect control={form.control} name="visibility" label="Visibility" options={visibilityOptions} />
        <FormSelect control={form.control} name="university" label="University" options={universities.options} />
        <FormSelect control={form.control} name="faculty" label="Faculty" options={faculties.options} />
        <FormSelect control={form.control} name="major" label="Major" options={majors.options} />
        <FormSelect control={form.control} name="academic_year" label="Academic year" options={years.options} />
        <FormSelect control={form.control} name="semester" label="Semester" options={semesters.options} />
        <FormSelect control={form.control} name="subject" label="Subject" options={subjects.options} />
        <FormSelect control={form.control} name="group" label="Group" options={groups.options} />
      </div>
      <FormTextarea control={form.control} name="description" label="Description" />
      <FormFileUpload control={form.control} name="file" label={editing ? "Replace file (optional)" : "File"} />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormSwitch control={form.control} name="is_printable" label="Printable" />
        <FormSwitch control={form.control} name="is_active" label="Active" />
      </div>
      {editing ? <ProtectedMediaButton getPreviewToken={() => getFilePreviewToken(editing.id)}>Open current file</ProtectedMediaButton> : null}
      {editing ? <ConfirmDialog trigger={<Button type="button" variant="destructive">Delete file</Button>} title="Delete file" description="This action cannot be undone." confirmLabel="Delete" onConfirm={onDelete} /> : null}
    </div>
  );
}

function valuesFromFile(file: FileRecord): FileFormValues {
  return { ...defaults, title: file.title, description: file.description ?? "", visibility: file.visibility, university: relatedId(file.university), faculty: relatedId(file.faculty), major: relatedId(file.major), academic_year: relatedId(file.academic_year), semester: relatedId(file.semester), subject: relatedId(file.subject), group: relatedId(file.group), is_printable: Boolean(file.is_printable), is_active: file.is_active !== false };
}

function relatedId(value: unknown) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object" && "id" in value) return String(value.id);
  return "";
}
