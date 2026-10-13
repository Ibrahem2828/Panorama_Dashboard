"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useEffect } from "react";

import { ErrorPanel } from "@/components/feedback/error-panel";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchProtectedMedia, previewKind, type ProtectedSource } from "@/features/files/protected-preview";
import { useI18n } from "@/i18n/provider";

export interface PreviewTarget { title: string; source: ProtectedSource; file_type?: string }

/** Protected in-app preview: ticket -> BFF stream -> Blob -> object URL (revoked on close). Used for library files and support attachments. */
export function FilePreviewDialog({ target, onOpenChange }: { target: PreviewTarget | null; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n();
  const source = target?.source;
  const query = useQuery({
    queryKey: ["protected-preview", source?.key],
    enabled: source !== undefined,
    queryFn: async ({ signal }) => {
      const media = await fetchProtectedMedia(source as NonNullable<typeof source>, signal);
      return { objectUrl: URL.createObjectURL(media.blob.type === media.mimeType ? media.blob : new Blob([media.blob], { type: media.mimeType })), mimeType: media.mimeType };
    },
    // A ticket is short-lived: never cache the bytes, fetch a fresh ticket per opening.
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  const objectUrl = query.data?.objectUrl ?? null;
  const mime = query.data?.mimeType;
  // The object URL holds the protected bytes in memory: release it when the dialog closes or a new copy replaces it.
  useEffect(() => (objectUrl ? () => URL.revokeObjectURL(objectUrl) : undefined), [objectUrl]);
  const kind = previewKind(mime, target?.file_type);
  const title = target?.title ?? "";

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("files.previewTitle", { title })}</DialogTitle>
          <DialogDescription>{t("files.previewDescription")}</DialogDescription>
        </DialogHeader>
        {query.isPending ? <Skeleton className="h-[60vh] rounded-xl" aria-label={t("common.loading")} /> : query.isError ? (
          <ErrorPanel error={query.error} retry={() => query.refetch()} />
        ) : objectUrl && kind === "pdf" ? (
          <iframe title={t("files.previewFrameTitle", { title })} src={`${objectUrl}#toolbar=0&navpanes=0`} referrerPolicy="no-referrer" className="h-[70vh] w-full rounded-xl border" data-testid="protected-preview-frame" />
        ) : objectUrl && kind === "image" ? (
          <Image src={objectUrl} alt={title} width={1600} height={1200} unoptimized className="max-h-[70vh] w-full rounded-xl object-contain" data-testid="protected-preview-image" />
        ) : (
          <p className="rounded-xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">{t("files.previewUnsupported")}</p>
        )}
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" aria-hidden="true" />{t("files.protectedNotice")}</p>
      </DialogContent>
    </Dialog>
  );
}
