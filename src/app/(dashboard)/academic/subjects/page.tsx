import { AcademicCrudPage } from "@/features/academic/components/academic-crud-page";

export default function SubjectsPage() {
  return (
    <AcademicCrudPage
      resource="subjects"
      title="Subjects"
      description="Manage subject catalog records by major, academic year, and semester."
      actionLabel="Add subject"
      fields={["major", "academic_year", "semester", "name", "code", "description", "is_active"]}
      columns={["name", "code", "major", "academic_year", "semester", "is_active"]}
    />
  );
}
