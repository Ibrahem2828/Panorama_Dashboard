import { AcademicCrudPage } from "@/features/academic/components/academic-crud-page";

export default function SemestersPage() {
  return (
    <AcademicCrudPage
      resource="semesters"
      title="Semesters"
      description="Manage semester definitions used by subjects, groups, and files."
      actionLabel="Add semester"
      fields={["name", "order", "is_active"]}
      columns={["name", "order", "is_active"]}
    />
  );
}
