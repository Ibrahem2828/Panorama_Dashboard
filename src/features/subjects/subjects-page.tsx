"use client";

import { useMemo } from "react";

import { academicFields, useAcademicLookups } from "@/components/filters/academic-filters";
import type { ResourceColumn } from "@/components/data-grid/resource-table";
import { StatusPill } from "@/components/shared/status-pill";
import { ResourceManager, type ManagerFilterBar } from "@/features/resources/resource-manager";
import { SUBJECT_DEFAULT_SORT, subjectFields, subjectSortOptions } from "@/features/subjects/subjects-rules";
import { useCan } from "@/features/session";
import { useI18n } from "@/i18n/provider";
import { CAPABILITIES } from "@/lib/auth/capabilities";

/** Academic subjects: the contract-driven manager plus the shared filter bar and the groups / lectures / files counts. */
export function SubjectsPage() {
  const { t } = useI18n();
  const allowed = useCan(CAPABILITIES.academic);
  const academic = useAcademicLookups(allowed);

  const columns = useMemo<ResourceColumn[]>(() => [
    { key: "id", label: "#" },
    { key: "name" },
    { key: "code" },
    { key: "faculty_name" },
    { key: "major_name" },
    { key: "academic_year_name" },
    { key: "semester_name" },
    { key: "groups_count", label: t("subjects.col.groups") },
    { key: "lectures_count", label: t("subjects.col.lectures") },
    { key: "files_count", label: t("subjects.col.files") },
    { key: "is_active", render: (value) => <StatusPill value={value ? "active" : "inactive"} /> },
  ], [t]);

  const filterBar = useMemo<ManagerFilterBar>(() => ({
    fields: subjectFields(t, academicFields(t, academic)),
    sortOptions: subjectSortOptions(t),
    defaultSort: SUBJECT_DEFAULT_SORT,
    searchPlaceholder: t("subjects.searchPlaceholder"),
  }), [academic, t]);

  return (
    <ResourceManager
      resourceKey="subjects"
      title={t("nav.subjects")}
      description={t("academic.subtitle")}
      capability={CAPABILITIES.academic}
      columns={columns}
      filterBar={filterBar}
    />
  );
}
