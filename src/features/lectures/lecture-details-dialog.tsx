"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isStalled, type LectureRow } from "@/features/lectures/lecture-rules";
import { LectureStatusBadge } from "@/features/lectures/lecture-status-badge";
import { useI18n } from "@/i18n/provider";
import { formatDate, formatFileSize, formatNumber } from "@/lib/utils";

/** First characters of the SHA-256: enough to compare files, never the full fingerprint. */
export function shaPrefix(sha: string | undefined, length = 12): string {
  return sha ? sha.slice(0, length) : "—";
}

function Item({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "rounded-xl border bg-muted/30 p-3 sm:col-span-2" : "rounded-xl border bg-muted/30 p-3"}>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm">{children}</dd>
    </div>
  );
}

/** Read-only details of one lecture: processing state, failure reason, file facts and timestamps. The original file URL is never shown. */
export function LectureDetailsDialog({ lecture, now, onOpenChange }: { lecture: LectureRow | null; now: number; onOpenChange: (open: boolean) => void }) {
  const { t, locale } = useI18n();
  return (
    <Dialog open={Boolean(lecture)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("lectures.details.title")}</DialogTitle>
          <DialogDescription>{lecture?.title ?? ""}</DialogDescription>
        </DialogHeader>
        {lecture ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            <Item label={t("lectures.col.status")}><LectureStatusBadge status={lecture.status} /></Item>
            <Item label={t("lectures.col.published")}>{lecture.is_published ? t("lectures.published") : t("lectures.unpublished")}</Item>
            <Item label={t("lectures.col.subject")}>{lecture.subject_name ?? `#${lecture.subject}`}</Item>
            <Item label={t("lectures.details.pages")}>{formatNumber(lecture.page_count ?? 0, locale)}</Item>
            <Item label={t("common.description")} wide>{lecture.description?.trim() ? lecture.description : <span className="text-muted-foreground">{t("lectures.details.noDescription")}</span>}</Item>
            {lecture.failure_code || lecture.failure_message ? (
              <Item label={t("lectures.details.failure")} wide>
                <span role="note">{lecture.failure_message || "—"}</span>
                {lecture.failure_code ? <span className="ms-2 font-mono text-xs text-muted-foreground" dir="ltr">{lecture.failure_code}</span> : null}
              </Item>
            ) : null}
            {isStalled(lecture, now) ? <Item label={t("common.status")} wide>{t("lectures.details.stalled")}</Item> : null}
            <Item label={t("lectures.details.file")}><span dir="ltr" className="inline-block">{lecture.original_filename || "—"}</span></Item>
            <Item label={t("lectures.details.size")}>{formatFileSize(lecture.original_size)}</Item>
            <Item label={t("lectures.details.type")}><span dir="ltr" className="inline-block">{lecture.original_mime_type || "—"}</span></Item>
            <Item label={t("lectures.details.sha")}><span dir="ltr" className="inline-block font-mono text-xs">{shaPrefix(lecture.original_sha256)}</span></Item>
            <Item label={t("lectures.details.created")}>{formatDate(lecture.created_at, locale)}</Item>
            <Item label={t("lectures.details.updated")}>{formatDate(lecture.updated_at, locale)}</Item>
            <Item label={t("lectures.details.publishedAt")}>{formatDate(lecture.published_at, locale)}</Item>
            <Item label={t("lectures.details.uploader")}>{lecture.uploaded_by ?? "—"}</Item>
          </dl>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
