import { AcademicCrudPage } from "@/features/academic/components/academic-crud-page";

export default function AcademicYearsPage() {
  return (
    <AcademicCrudPage
      resource="academicYears"
      title="Academic Years"
      description="Manage academic year levels used by student profiles and content targeting."
      actionLabel="Add academic year"
      fields={["name", "order", "is_active"]}
      columns={["name", "order", "is_active"]}
    />
  );
}
