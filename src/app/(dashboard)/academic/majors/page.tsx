import { AcademicCrudPage } from "@/features/academic/components/academic-crud-page";

export default function MajorsPage() {
  return (
    <AcademicCrudPage
      resource="majors"
      title="Majors"
      description="Manage majors and connect them to faculties."
      actionLabel="Add major"
      fields={["faculty", "name", "code", "is_active"]}
      columns={["faculty", "name", "code", "is_active"]}
    />
  );
}
