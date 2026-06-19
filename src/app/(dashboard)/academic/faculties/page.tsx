import { AcademicCrudPage } from "@/features/academic/components/academic-crud-page";

const facultyCodes = [
  "1 = كلية الطب البشري",
  "2 = كلية طب الأسنان",
  "3 = كلية الصيدلة",
  "4 = كلية هندسة المعلوماتية",
  "5 = كلية هندسة البترول",
  "6 = كلية إدارة الأعمال",
  "7 = كلية هندسة تكنولوجيا البناء والتشييد",
];

export default function FacultiesPage() {
  return (
    <AcademicCrudPage
      resource="faculties"
      title="Faculties"
      description="Manage faculties and parser-compatible faculty codes."
      actionLabel="Add faculty"
      fields={["university", "name", "code", "is_active"]}
      columns={["university", "name", "code", "is_active"]}
      helper={
        <div className="space-y-2">
          <p>كود الكلية يجب أن يطابق أول رقم في الرقم الجامعي.</p>
          <p>{facultyCodes.join(" | ")}</p>
        </div>
      }
    />
  );
}
