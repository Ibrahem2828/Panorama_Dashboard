"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, FileText, ImageIcon, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChatMessage } from "@/features/chat/chat-logic";
import { useI18n } from "@/i18n/provider";
import { apiFetch, downloadFromBackend, unwrap } from "@/lib/api/browser-client";
import { formatFileSize } from "@/lib/utils";
import type { ApiEnvelope } from "@/types/api";

/** Chat attachments are protected: a short-lived ticket gives a one-off URL which is then read through the BFF. */
export async function fetchAttachmentBlob(groupId: number, messageId: number): Promise<Blob> {
  const ticket = await unwrap(apiFetch<ApiEnvelope<{ preview_url: string }>>(`/api/v1/groups/${groupId}/messages/${messageId}/attachment-ticket/`, { method: "POST" }));
  const response = await downloadFromBackend(new URL(ticket.preview_url).pathname);
  return response.blob();
}

export interface LoadedAttachment { blob: Blob; url: string }

/** Query key prefix of the cached attachment blobs; their object URLs are revoked when a query leaves the cache. */
export const ATTACHMENT_QUERY = "chat-attachment";

export function revokeAttachmentUrl(data: unknown) {
  if (data && typeof data === "object" && "url" in data && typeof data.url === "string") URL.revokeObjectURL(data.url);
}

function useAttachmentBlob(groupId: number, messageId: number, enabled: boolean) {
  return useQuery({
    queryKey: [ATTACHMENT_QUERY, groupId, messageId],
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 5 * 60_000,
    retry: 1,
    queryFn: async (): Promise<LoadedAttachment> => {
      const blob = await fetchAttachmentBlob(groupId, messageId);
      return { blob, url: URL.createObjectURL(blob) };
    },
  });
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Download button + file name: used by the bubble chip and by the media tab. */
export function AttachmentChip({ groupId, message, className }: { groupId: number; message: ChatMessage; className?: string }) {
  const { t, locale } = useI18n();
  const [busy, setBusy] = useState(false);
  const meta = message.attachment_meta;
  const name = meta?.name || t("chatConsole.attachment");
  const size = meta?.size ? formatFileSize(meta.size, locale) : null;
  const download = async () => {
    setBusy(true);
    try { saveBlob(await fetchAttachmentBlob(groupId, message.id), name); } catch { toast.error(t("chatConsole.attachmentFailed")); } finally { setBusy(false); }
  };
  return (
    <div className={`flex items-center gap-2 rounded-lg border bg-background/80 p-2 ${className ?? ""}`}>
      {message.message_type === "image" ? <ImageIcon className="size-6 shrink-0 text-primary" aria-hidden /> : <FileText className="size-6 shrink-0 text-primary" aria-hidden />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold" dir="auto">{name}</div>
        {size ? <div className="text-xs text-muted-foreground">{size}</div> : null}
      </div>
      <Button type="button" size="icon" variant="ghost" className="size-8" aria-label={`${t("chatConsole.download")}: ${name}`} disabled={busy} onClick={() => void download()}>
        {busy ? <Loader2 className="animate-spin" /> : <Download />}
      </Button>
    </div>
  );
}

/** Inline image (opens a larger preview) or, for PDFs and other files, a chip with a download button. */
export function MessageAttachment({ groupId, message }: { groupId: number; message: ChatMessage }) {
  const { t } = useI18n();
  const isImage = message.message_type === "image";
  const query = useAttachmentBlob(groupId, message.id, isImage);
  const url = query.data?.url ?? null;
  const [open, setOpen] = useState(false);
  if (!isImage) return <AttachmentChip groupId={groupId} message={message} />;
  if (query.isError) return <AttachmentChip groupId={groupId} message={message} />;
  if (!url) return <Skeleton className="h-40 w-56 max-w-full rounded-lg" aria-label={t("common.loading")} />;
  const name = message.attachment_meta?.name || t("chatConsole.attachment");
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${t("chatConsole.openImage")}: ${name}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name} className="max-h-72 max-w-full rounded-lg object-cover" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>{name}</DialogTitle><DialogDescription>{t("chatConsole.imagePreview")}</DialogDescription></DialogHeader>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={name} className="max-h-[70vh] w-full rounded-lg object-contain" />
          <AttachmentChip groupId={groupId} message={message} />
        </DialogContent>
      </Dialog>
    </>
  );
}
