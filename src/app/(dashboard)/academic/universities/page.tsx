import { AcademicCrudPage } from "@/features/academic/components/academic-crud-page";

export default function UniversitiesPage() {
  return (
    <AcademicCrudPage
      resource="universities"
      title="Universities"
      description="Manage universities available to Panorama students."
      actionLabel="Add university"
      fields={["name", "code", "description", "is_active"]}
      columns={["name", "code", "is_active", "created_at"]}
    />
  );
}
