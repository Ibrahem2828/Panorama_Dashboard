"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { z } from "zod";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTableRowActions } from "@/components/data-table/data-table-row-actions";
import { FormInput } from "@/components/forms/form-input";
import { FormSelect } from "@/components/forms/form-select";
import { FormSwitch } from "@/components/forms/form-switch";
import { FormTextarea } from "@/components/forms/form-textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EntityDialog } from "@/components/shared/entity-dialog";
import { TablePageShell } from "@/components/shared/table-page-shell";
import type { AcademicEntity, AcademicFormValues, Faculty, Major, Subject } from "@/features/academic/types";
import { useAcademicList, useAcademicYears, useCreateAcademic, useDeleteAcademic, useFaculties, useMajors, useSemesters, useUpdateAcademic, useUniversities } from "@/features/academic/hooks";
import type { AcademicResourceKey } from "@/features/academic/api";
import { listData } from "@/lib/api/crud";
import { formatDate, getRelatedName } from "@/features/academic/components/helpers";
import { AccessDenied } from "@/components/shared/access-denied";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canManageAcademic } from "@/lib/permissions";

type FieldKind = "university" | "faculty" | "major" | "academic_year" | "semester" | "name" | "code" | "description" | "order" | "is_active" | "created_at";

interface AcademicCrudPageProps {
  resource: AcademicResourceKey;
  title: string;
  description: string;
  actionLabel: string;
  fields: FieldKind[];
  columns: FieldKind[];
  helper?: React.ReactNode;
  queryParams?: Record<string, string | number | boolean | null | undefined>;
}

const schema = z.object({
  university: z.string().optional(),
  faculty: z.string().optional(),
  major: z.string().optional(),
  academic_year: z.string().optional(),
  semester: z.string().optional(),
  name: z.string().min(2, "Name must be at least 2 characters."),
  code: z.string().optional(),
  description: z.string().optional(),
  order: z.string().optional(),
  is_active: z.boolean(),
});

const defaultValues: AcademicFormValues = {
  university: "",
  faculty: "",
  major: "",
  academic_year: "",
  semester: "",
  name: "",
  code: "",
  description: "",
  order: "",
  is_active: true,
};

export function AcademicCrudPage({
  resource,
  title,
  description,
  actionLabel,
  fields,
  columns: columnKeys,
  helper,
  queryParams,
}: AcademicCrudPageProps) {
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicEntity | null>(null);
  const listQuery = useAcademicList(resource, queryParams);
  const createMutation = useCreateAcademic(resource);
  const updateMutation = useUpdateAcademic(resource);
  const deleteMutation = useDeleteAcademic(resource);
  const data = listData(listQuery.data);

  const columns = useMemo<ColumnDef<AcademicEntity>[]>(() => {
    const generated: ColumnDef<AcademicEntity>[] = columnKeys.map((key) => ({
      accessorKey: key,
      header: ({ column }) => <DataTableColumnHeader column={column} title={columnTitle(key)} />,
      cell: ({ row }) => renderCell(row.original, key),
    }));

    generated.push({
      id: "actions",
      cell: ({ row }) => (
        <DataTableRowActions
          row={row.original}
          actions={[
            {
              label: "Edit",
              onClick: (record) => {
                setEditing(record);
                setOpen(true);
              },
            },
          ]}
        />
      ),
    });

    return generated;
  }, [columnKeys]);

  const dialogDefaults = editing ? valuesFromEntity(editing) : defaultValues;

  if (!canManageAcademic(user?.role)) {
    return <AccessDenied title={`${title} restricted`} description="Academic management limited to it_support and admin roles." />;
  }

  return (
    <TablePageShell
      title={title}
      description={description}
      actionLabel={actionLabel}
      onAction={() => {
        setEditing(null);
        setOpen(true);
      }}
      error={listQuery.error}
      onRetry={() => listQuery.refetch()}
    >
      <DataTable
        columns={columns}
        data={data}
        loading={listQuery.isLoading}
        searchPlaceholder={`Search ${title.toLowerCase()}`}
        emptyTitle={`No ${title.toLowerCase()} found`}
        emptyDescription="Create the first record to make it available across Panorama."
      />
      <EntityDialog<AcademicFormValues>
        open={open}
        onOpenChange={setOpen}
        title={editing ? `Edit ${title}` : actionLabel}
        description={description}
        schema={schema}
        defaultValues={dialogDefaults}
        submitLabel={editing ? "Save changes" : "Create"}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onSubmit={async (values) => {
          if (editing) {
            await updateMutation.mutateAsync({ id: editing.id, values });
          } else {
            await createMutation.mutateAsync(values);
          }
        }}
      >
        {(form) => (
          <div className="space-y-4">
            {helper ? <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">{helper}</div> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.includes("university") ? <LookupSelect kind="university" form={form} /> : null}
              {fields.includes("faculty") ? <LookupSelect kind="faculty" form={form} /> : null}
              {fields.includes("major") ? <LookupSelect kind="major" form={form} /> : null}
              {fields.includes("academic_year") ? <LookupSelect kind="academic_year" form={form} /> : null}
              {fields.includes("semester") ? <LookupSelect kind="semester" form={form} /> : null}
              {fields.includes("name") ? <FormInput control={form.control} name="name" label="Name" /> : null}
              {fields.includes("code") ? <FormInput control={form.control} name="code" label="Code" /> : null}
              {fields.includes("order") ? <FormInput control={form.control} name="order" label="Order" type="number" /> : null}
            </div>
            {fields.includes("description") ? <FormTextarea control={form.control} name="description" label="Description" /> : null}
            {fields.includes("is_active") ? <FormSwitch control={form.control} name="is_active" label="Active" /> : null}
            {editing ? (
              <ConfirmDialog
                trigger={
                  <Button type="button" variant="destructive" size="sm" disabled={deleteMutation.isPending}>
                    <Trash2 />
                    Delete record
                  </Button>
                }
                title="Delete record"
                description="This action cannot be undone. Backend constraints may prevent deletion when the record is in use."
                confirmLabel="Delete"
                onConfirm={() => deleteMutation.mutate(editing.id, { onSuccess: () => setOpen(false) })}
              />
            ) : null}
          </div>
        )}
      </EntityDialog>
    </TablePageShell>
  );
}

function LookupSelect({
  kind,
  form,
}: {
  kind: "university" | "faculty" | "major" | "academic_year" | "semester";
  form: UseFormReturn<AcademicFormValues>;
}) {
  const university = form.watch("university");
  const faculty = form.watch("faculty");
  const universities = useUniversities();
  const faculties = useFaculties(university);
  const majors = useMajors(faculty);
  const years = useAcademicYears();
  const semesters = useSemesters();
  const options = {
    university: universities.options,
    faculty: faculties.options,
    major: majors.options,
    academic_year: years.options,
    semester: semesters.options,
  }[kind];

  return <FormSelect control={form.control} name={kind} label={columnTitle(kind)} placeholder={`Select ${columnTitle(kind).toLowerCase()}`} options={options} />;
}

function columnTitle(key: FieldKind) {
  const titles: Record<FieldKind, string> = {
    university: "University",
    faculty: "Faculty",
    major: "Major",
    academic_year: "Academic Year",
    semester: "Semester",
    name: "Name",
    code: "Code",
    description: "Description",
    order: "Order",
    is_active: "Status",
    created_at: "Created",
  };
  return titles[key];
}

function renderCell(entity: AcademicEntity, key: FieldKind) {
  if (key === "is_active") {
    return entity.is_active === false ? <Badge variant="outline">Inactive</Badge> : <Badge variant="success">Active</Badge>;
  }
  if (key === "created_at") {
    return formatDate(entity.created_at);
  }
  if (key === "university") {
    return getRelatedName((entity as Faculty).university);
  }
  if (key === "faculty") {
    return getRelatedName((entity as Major).faculty);
  }
  if (key === "major") {
    return getRelatedName((entity as Subject).major);
  }
  if (key === "academic_year") {
    return getRelatedName((entity as Subject).academic_year);
  }
  if (key === "semester") {
    return getRelatedName((entity as Subject).semester);
  }
  return String(entity[key as keyof AcademicEntity] ?? "-");
}

function valuesFromEntity(entity: AcademicEntity): AcademicFormValues {
  return {
    university: relatedId((entity as Faculty).university),
    faculty: relatedId((entity as Major).faculty),
    major: relatedId((entity as Subject).major),
    academic_year: relatedId((entity as Subject).academic_year),
    semester: relatedId((entity as Subject).semester),
    name: entity.name ?? "",
    code: entity.code ?? "",
    description: entity.description ?? "",
    order: entity.order ? String(entity.order) : "",
    is_active: entity.is_active !== false,
  };
}

function relatedId(value: unknown) {
  if (typeof value === "number" || typeof value === "string") {
    return String(value);
  }
  if (value && typeof value === "object" && "id" in value) {
    return String(value.id);
  }
  return "";
}
