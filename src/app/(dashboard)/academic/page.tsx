"use client";

import Link from "next/link";
import { BookOpen, CalendarDays, GraduationCap, Landmark, Layers3, School, UsersRound } from "lucide-react";

import { AccessDenied } from "@/components/shared/access-denied";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canManageAcademic } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";

const academicLinks = [
  { title: "Universities", href: ROUTES.universities, icon: Landmark, description: "University master data" },
  { title: "Faculties", href: ROUTES.faculties, icon: School, description: "Parser-compatible faculty codes" },
  { title: "Majors", href: ROUTES.majors, icon: GraduationCap, description: "Academic majors by faculty" },
  { title: "Academic Years", href: ROUTES.academicYears, icon: CalendarDays, description: "Year levels used across students" },
  { title: "Semesters", href: ROUTES.semesters, icon: Layers3, description: "Semester definitions" },
  { title: "Subjects", href: ROUTES.subjects, icon: BookOpen, description: "Subject catalog by major/year/semester" },
];

export default function AcademicPage() {
  const user = useCurrentUser();
  if (!canManageAcademic(user?.role)) {
    return <AccessDenied title="Academic Structure restricted" description="Academic management is available only to it_support and admin roles." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Structure"
        description="Configure the academic hierarchy used by verification, files, groups, and student services. (الهيكل الأكاديمي)"
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {academicLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="h-full transition-colors hover:bg-muted/40">
                <CardContent className="flex items-start gap-4 p-5">
                  <div className="rounded-md bg-primary/10 p-2 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="font-semibold">{item.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
      <EmptyState
        title="Build academic data in order"
        description="Start with universities, then faculties, majors, academic years, semesters, and finally subjects."
        action={
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <UsersRound className="size-4" />
            Used by verification, groups, files, and announcements
          </div>
        }
      />
    </div>
  );
}
