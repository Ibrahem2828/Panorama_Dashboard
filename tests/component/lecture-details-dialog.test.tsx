/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LectureDetailsDialog } from "@/features/lectures/lecture-details-dialog";
import type { LectureRow } from "@/features/lectures/lecture-rules";
import { I18nProvider } from "@/i18n/provider";

afterEach(cleanup);

const general: LectureRow = { id: 9, subject: null, subject_name: null, faculty: null, faculty_name: null, is_general: true, title: "Orientation", status: "ready", is_published: false };

function show(lecture: LectureRow, locale: "ar" | "en" = "ar") {
  render(<I18nProvider locale={locale}><LectureDetailsDialog lecture={lecture} now={Date.now()} onOpenChange={() => undefined} /></I18nProvider>);
}

describe("lecture details for a general lecture", () => {
  it("never prints #null: shows 'محاضرة عامة' and 'كل الكليات'", () => {
    show(general);
    expect(screen.getByText("محاضرة عامة")).toBeTruthy();
    expect(screen.getByText("كل الكليات")).toBeTruthy();
    expect(document.body.textContent).not.toContain("null");
  });

  it("shows the faculty name of a faculty-scoped general lecture", () => {
    show({ ...general, faculty: 3, faculty_name: "كلية الهندسة" });
    expect(screen.getByText("كلية الهندسة")).toBeTruthy();
  });

  it("shows the subject name of a subject lecture", () => {
    show({ ...general, is_general: false, subject: 4, subject_name: "الخوارزميات", faculty_name: "كلية الهندسة" });
    expect(screen.getByText("الخوارزميات")).toBeTruthy();
  });
});
