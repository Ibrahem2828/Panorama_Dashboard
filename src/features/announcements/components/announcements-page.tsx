"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
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
import { RemoteImage } from "@/components/shared/remote-image";
import { StatusBadge } from "@/components/shared/status-badge";
import { TablePageShell } from "@/components/shared/table-page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAcademicYears, useFaculties, useMajors, useSemesters, useUniversities } from "@/features/academic/hooks";
import { formatDate } from "@/features/academic/components/helpers";
import type { Announcement, AnnouncementFormValues } from "@/features/announcements/types";
import { useAnnouncements, useCreateAnnouncement, useDeleteAnnouncement, useUpdateAnnouncement } from "@/features/announcements/hooks";
import { listData } from "@/lib/api/crud";
import { readString } from "@/lib/object";

const targetOptions = ["all", "normal_users", "students", "verified_students", "admins"].map((value) => ({ label: value, value }));
const schema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  image: (typeof File === "undefined" ? z.unknown() : z.instanceof(File)).nullable().optional(),
  link: z.string().optional(),
  target_user_type: z.string().min(1),
  target_university: z.string().optional(),
  target_faculty: z.string().optional(),
  target_major: z.string().optional(),
  target_academic_year: z.string().optional(),
  target_semester: z.string().optional(),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
  is_active: z.boolean(),
});
const defaults: AnnouncementFormValues = { title: "", description: "", image: null, link: "", target_user_type: "all", target_university: "", target_faculty: "", target_major: "", target_academic_year: "", target_semester: "", starts_at: "", ends_at: "", is_active: true };

export function AnnouncementsPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const listQuery = useAnnouncements();
  const createMutation = useCreateAnnouncement();
  const updateMutation = useUpdateAnnouncement();
  const deleteMutation = useDeleteAnnouncement();
  const rows = listData(listQuery.data);
  const columns = useMemo<ColumnDef<Announcement>[]>(() => [
    { accessorKey: "image", header: "Image", cell: ({ row }) => <RemoteImage src={row.original.image_url ?? row.original.image} alt={row.original.title} /> },
    { accessorKey: "title", header: ({ column }) => <DataTableColumnHeader column={column} title="Title" /> },
    { accessorKey: "target_user_type", header: "Target", cell: ({ row }) => <StatusBadge status={row.original.target_user_type} /> },
    { accessorKey: "starts_at", header: "Starts", cell: ({ row }) => formatDate(row.original.starts_at) },
    { accessorKey: "ends_at", header: "Ends", cell: ({ row }) => formatDate(row.original.ends_at) },
    { accessorKey: "is_active", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.is_active === false ? "inactive" : "active"} /> },
    { accessorKey: "created_by", header: "Created by", cell: ({ row }) => readString(row.original, ["created_by.full_name", "created_by.email"]) },
    { id: "actions", cell: ({ row }) => <DataTableRowActions row={row.original} actions={[{ label: "Edit", onClick: (record) => { setEditing(record); setOpen(true); } }]} /> },
  ], []);

  return (
    <TablePageShell title="Announcements" description="Create targeted announcements for mobile users and admins." actionLabel="Create announcement" onAction={() => { setEditing(null); setOpen(true); }} error={listQuery.error} onRetry={() => listQuery.refetch()}>
      <DataTable columns={columns} data={rows} loading={listQuery.isLoading} searchPlaceholder="Search announcements" />
      <EntityDialog<AnnouncementFormValues> open={open} onOpenChange={setOpen} title={editing ? "Edit announcement" : "Create announcement"} description="Configure targeting, schedule, image, and mobile preview." schema={schema} defaultValues={editing ? valuesFromAnnouncement(editing) : defaults} submitLabel={editing ? "Save changes" : "Create"} isSubmitting={createMutation.isPending || updateMutation.isPending} onSubmit={async (values) => { if (editing) await updateMutation.mutateAsync({ id: editing.id, values }); else await createMutation.mutateAsync(values); }}>
        {(form) => <AnnouncementFields form={form} editing={editing} onDelete={() => deleteMutation.mutate(editing?.id ?? 0, { onSuccess: () => setOpen(false) })} />}
      </EntityDialog>
    </TablePageShell>
  );
}

function AnnouncementFields({ form, editing, onDelete }: { form: UseFormReturn<AnnouncementFormValues>; editing: Announcement | null; onDelete: () => void }) {
  const university = form.watch("target_university");
  const faculty = form.watch("target_faculty");
  const title = form.watch("title");
  const description = form.watch("description");
  const target = form.watch("target_user_type");
  const universities = useUniversities();
  const faculties = useFaculties(university);
  const majors = useMajors(faculty);
  const years = useAcademicYears();
  const semesters = useSemesters();

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormInput control={form.control} name="title" label="Title" />
        <FormInput control={form.control} name="link" label="Link" />
        <FormSelect control={form.control} name="target_user_type" label="Target user type" options={targetOptions} />
        <FormSelect control={form.control} name="target_university" label="Target university" options={universities.options} />
        <FormSelect control={form.control} name="target_faculty" label="Target faculty" options={faculties.options} />
        <FormSelect control={form.control} name="target_major" label="Target major" options={majors.options} />
        <FormSelect control={form.control} name="target_academic_year" label="Target academic year" options={years.options} />
        <FormSelect control={form.control} name="target_semester" label="Target semester" options={semesters.options} />
        <FormInput control={form.control} name="starts_at" label="Starts at" type="datetime-local" />
        <FormInput control={form.control} name="ends_at" label="Ends at" type="datetime-local" />
      </div>
      <FormTextarea control={form.control} name="description" label="Description" />
      <FormFileUpload control={form.control} name="image" label="Image" accept="image/*" />
      <FormSwitch control={form.control} name="is_active" label="Active" />
      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Mobile preview</p>
          <h3 className="mt-2 font-semibold">{title || "Announcement title"}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description || "Announcement body will appear here."}</p>
          <div className="mt-3"><StatusBadge status={target || "all"} /></div>
        </CardContent>
      </Card>
      {editing ? <ConfirmDialog trigger={<Button type="button" variant="destructive">Delete announcement</Button>} title="Delete announcement" description="This action cannot be undone." confirmLabel="Delete" onConfirm={onDelete} /> : null}
    </div>
  );
}

function valuesFromAnnouncement(item: Announcement): AnnouncementFormValues {
  return { ...defaults, title: item.title, description: item.description ?? "", link: item.link ?? "", target_user_type: item.target_user_type, target_university: relatedId(item.target_university), target_faculty: relatedId(item.target_faculty), target_major: relatedId(item.target_major), target_academic_year: relatedId(item.target_academic_year), target_semester: relatedId(item.target_semester), starts_at: toInputDate(item.starts_at), ends_at: toInputDate(item.ends_at), is_active: item.is_active !== false };
}
function relatedId(value: unknown) { if (typeof value === "string" || typeof value === "number") return String(value); if (value && typeof value === "object" && "id" in value) return String(value.id); return ""; }
function toInputDate(value?: string) { return value ? value.slice(0, 16) : ""; }
