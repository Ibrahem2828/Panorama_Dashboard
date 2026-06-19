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
import { DetailDialog } from "@/components/shared/detail-dialog";
import { EntityDialog } from "@/components/shared/entity-dialog";
import { FieldGrid, FieldItem } from "@/components/shared/field-grid";
import { RemoteImage } from "@/components/shared/remote-image";
import { StatusActionDialog } from "@/components/shared/status-action-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { TablePageShell } from "@/components/shared/table-page-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAcademicYears, useFaculties, useMajors, useSemesters, useSubjects, useUniversities } from "@/features/academic/hooks";
import { formatDate, getRelatedName } from "@/features/academic/components/helpers";
import type { Group, GroupFormValues, GroupMembership } from "@/features/groups/types";
import { useCreateGroup, useDeleteGroup, useGroupJoinRequests, useGroupMemberships, useGroups, useMembershipMutation, useUpdateGroup } from "@/features/groups/hooks";
import { listData } from "@/lib/api/crud";
import { readString } from "@/lib/object";

const schema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  image: (typeof File === "undefined" ? z.unknown() : z.instanceof(File)).nullable().optional(),
  university: z.string().optional(),
  faculty: z.string().optional(),
  major: z.string().optional(),
  academic_year: z.string().optional(),
  semester: z.string().optional(),
  subject: z.string().optional(),
  requires_approval: z.boolean(),
  send_messages_permission: z.enum(["all_members", "admins_only"]),
  is_active: z.boolean(),
});

const defaults: GroupFormValues = {
  name: "",
  description: "",
  image: null,
  university: "",
  faculty: "",
  major: "",
  academic_year: "",
  semester: "",
  subject: "",
  requires_approval: true,
  send_messages_permission: "all_members",
  is_active: true,
};

export function GroupsPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [selected, setSelected] = useState<Group | null>(null);
  const [roleTarget, setRoleTarget] = useState<GroupMembership | null>(null);
  const listQuery = useGroups();
  const createMutation = useCreateGroup();
  const updateMutation = useUpdateGroup();
  const deleteMutation = useDeleteGroup();
  const membershipMutation = useMembershipMutation();
  const membershipsQuery = useGroupMemberships(selected?.id);
  const joinRequestsQuery = useGroupJoinRequests(selected?.id);
  const rows = listData(listQuery.data);

  const columns = useMemo<ColumnDef<Group>[]>(() => [
    { accessorKey: "image", header: "Image", cell: ({ row }) => <RemoteImage src={row.original.image_url ?? row.original.image} alt={row.original.name} /> },
    { accessorKey: "name", header: ({ column }) => <DataTableColumnHeader column={column} title="Name" /> },
    { accessorKey: "university", header: "University", cell: ({ row }) => getRelatedName(row.original.university) },
    { accessorKey: "faculty", header: "Faculty", cell: ({ row }) => getRelatedName(row.original.faculty) },
    { accessorKey: "major", header: "Major", cell: ({ row }) => getRelatedName(row.original.major) },
    { accessorKey: "academic_year", header: "Year", cell: ({ row }) => getRelatedName(row.original.academic_year) },
    { accessorKey: "subject", header: "Subject", cell: ({ row }) => getRelatedName(row.original.subject) },
    { accessorKey: "requires_approval", header: "Approval", cell: ({ row }) => row.original.requires_approval ? "Required" : "Open" },
    { accessorKey: "send_messages_permission", header: "Messages", cell: ({ row }) => <StatusBadge status={row.original.send_messages_permission ?? "all_members"} /> },
    { accessorKey: "members_count", header: "Members", cell: ({ row }) => row.original.members_count ?? 0 },
    { accessorKey: "is_active", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.is_active === false ? "inactive" : "active"} /> },
    {
      id: "actions",
      cell: ({ row }) => (
        <DataTableRowActions
          row={row.original}
          actions={[
            { label: "View details", onClick: setSelected },
            { label: "Edit", onClick: (record) => { setEditing(record); setOpen(true); } },
          ]}
        />
      ),
    },
  ], []);

  return (
    <TablePageShell
      title="Groups"
      description="Manage study groups, memberships, join requests, image, and send permissions. (المجموعات)"
      actionLabel="Create group"
      onAction={() => { setEditing(null); setOpen(true); }}
      error={listQuery.error}
      onRetry={() => listQuery.refetch()}
    >
      <DataTable columns={columns} data={rows} loading={listQuery.isLoading} searchPlaceholder="Search groups" />
      <EntityDialog<GroupFormValues>
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit group" : "Create group"}
        description="admins_only means only group admins/moderators/global admins can send messages."
        schema={schema}
        defaultValues={editing ? valuesFromGroup(editing) : defaults}
        submitLabel={editing ? "Save changes" : "Create group"}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onSubmit={async (values) => {
          if (editing) await updateMutation.mutateAsync({ id: editing.id, values });
          else await createMutation.mutateAsync(values);
        }}
      >
        {(form) => <GroupFormFields form={form} editing={editing} onDelete={() => deleteMutation.mutate(editing?.id ?? 0, { onSuccess: () => setOpen(false) })} />}
      </EntityDialog>
      <DetailDialog open={Boolean(selected)} onOpenChange={(next) => !next && setSelected(null)} title={selected?.name ?? "Group detail"}>
        {selected ? (
          <Tabs defaultValue="overview">
            <TabsList className="mb-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="requests">Join Requests</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <FieldGrid title="Group overview">
                <FieldItem label="Name" value={selected.name} />
                <FieldItem label="University" value={getRelatedName(selected.university)} />
                <FieldItem label="Faculty" value={getRelatedName(selected.faculty)} />
                <FieldItem label="Major" value={getRelatedName(selected.major)} />
                <FieldItem label="Subject" value={getRelatedName(selected.subject)} />
                <FieldItem label="Status" value={<StatusBadge status={selected.is_active === false ? "inactive" : "active"} />} />
              </FieldGrid>
            </TabsContent>
            <TabsContent value="members">
              <MembershipTable
                data={listData(membershipsQuery.data)}
                loading={membershipsQuery.isLoading}
                onAction={(membership, action) => membershipMutation.mutate({ id: membership.id, action })}
                onRole={setRoleTarget}
              />
            </TabsContent>
            <TabsContent value="requests">
              <MembershipTable
                data={listData(joinRequestsQuery.data)}
                loading={joinRequestsQuery.isLoading}
                onAction={(membership, action) => membershipMutation.mutate({ id: membership.id, action })}
                onRole={setRoleTarget}
              />
            </TabsContent>
            <TabsContent value="settings">
              <p className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">Messages/files tabs are reserved until dashboard message/file endpoints are exposed.</p>
            </TabsContent>
          </Tabs>
        ) : null}
      </DetailDialog>
      <StatusActionDialog
        open={Boolean(roleTarget)}
        onOpenChange={(next) => !next && setRoleTarget(null)}
        title="Update membership role"
        submitLabel="Update role"
        loading={membershipMutation.isPending}
        options={{ field: "role", label: "Role", items: ["member", "moderator", "group_admin"].map((role) => ({ label: role, value: role })) }}
        fields={[]}
        onSubmit={async (values) => {
          if (roleTarget && values.role) await membershipMutation.mutateAsync({ id: roleTarget.id, role: values.role });
          setRoleTarget(null);
        }}
      />
    </TablePageShell>
  );
}

function GroupFormFields({ form, editing, onDelete }: { form: UseFormReturn<GroupFormValues>; editing: Group | null; onDelete: () => void }) {
  const university = form.watch("university");
  const faculty = form.watch("faculty");
  const major = form.watch("major");
  const universities = useUniversities();
  const faculties = useFaculties(university);
  const majors = useMajors(faculty);
  const years = useAcademicYears();
  const semesters = useSemesters();
  const subjects = useSubjects({ major: major || undefined });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormInput control={form.control} name="name" label="Name" />
        <FormSelect control={form.control} name="send_messages_permission" label="Message permission" options={[{ label: "All members (كل الأعضاء)", value: "all_members" }, { label: "Admins only (المشرفون فقط)", value: "admins_only" }]} />
        <p className="text-xs text-muted-foreground -mt-2">all_members: كل الأعضاء المقبولين يمكنهم الإرسال. admins_only: المشرفون والإدارة فقط.</p>
        <FormSelect control={form.control} name="university" label="University" options={universities.options} />
        <FormSelect control={form.control} name="faculty" label="Faculty" options={faculties.options} />
        <FormSelect control={form.control} name="major" label="Major" options={majors.options} />
        <FormSelect control={form.control} name="academic_year" label="Academic year" options={years.options} />
        <FormSelect control={form.control} name="semester" label="Semester" options={semesters.options} />
        <FormSelect control={form.control} name="subject" label="Subject" options={subjects.options} />
      </div>
      <FormTextarea control={form.control} name="description" label="Description" />
      <FormFileUpload control={form.control} name="image" label="Group image" accept="image/*" />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormSwitch control={form.control} name="requires_approval" label="Requires approval" />
        <FormSwitch control={form.control} name="is_active" label="Active" />
      </div>
      {editing ? (
        <ConfirmDialog trigger={<Button type="button" variant="destructive">Delete group</Button>} title="Delete group" description="This action cannot be undone." confirmLabel="Delete" onConfirm={onDelete} />
      ) : null}
    </div>
  );
}

function MembershipTable({ data, loading, onAction, onRole }: { data: GroupMembership[]; loading?: boolean; onAction: (membership: GroupMembership, action: "approve" | "reject" | "block") => void; onRole: (membership: GroupMembership) => void }) {
  const columns = useMemo<ColumnDef<GroupMembership>[]>(() => [
    { accessorKey: "user", header: "User", cell: ({ row }) => readString(row.original, ["user.full_name"]) },
    { accessorKey: "email", header: "Email", cell: ({ row }) => readString(row.original, ["user.email"]) },
    { accessorKey: "phone", header: "Phone", cell: ({ row }) => readString(row.original, ["user.phone_number"]) },
    { accessorKey: "role", header: "Role", cell: ({ row }) => <StatusBadge status={row.original.role ?? "member"} /> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status ?? "pending"} /> },
    { accessorKey: "joined_at", header: "Joined", cell: ({ row }) => formatDate(row.original.joined_at) },
    { id: "actions", cell: ({ row }) => <DataTableRowActions row={row.original} actions={[
      { label: "Approve", onClick: (record) => onAction(record, "approve") },
      { label: "Reject", onClick: (record) => onAction(record, "reject"), destructive: true },
      { label: "Block", onClick: (record) => onAction(record, "block"), destructive: true },
      { label: "Update role", onClick: onRole },
    ]} /> },
  ], [onAction, onRole]);

  return <DataTable columns={columns} data={data} loading={loading} searchPlaceholder="Search memberships" />;
}

function valuesFromGroup(group: Group): GroupFormValues {
  return {
    ...defaults,
    name: group.name,
    description: group.description ?? "",
    university: relatedId(group.university),
    faculty: relatedId(group.faculty),
    major: relatedId(group.major),
    academic_year: relatedId(group.academic_year),
    semester: relatedId(group.semester),
    subject: relatedId(group.subject),
    requires_approval: group.requires_approval ?? true,
    send_messages_permission: group.send_messages_permission ?? "all_members",
    is_active: group.is_active !== false,
  };
}

function relatedId(value: unknown) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object" && "id" in value) return String(value.id);
  return "";
}
