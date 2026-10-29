"use client";

import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";

import { ErrorPanel } from "@/components/feedback/error-panel";
import { StatusPill } from "@/components/shared/status-pill";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AttachmentChip } from "@/features/chat/chat-attachment";
import { SenderAvatar } from "@/features/chat/chat-bubbles";
import { attachmentMessages, type ChatMessage } from "@/features/chat/chat-logic";
import { membersListPath } from "@/features/groups/group-rules";
import { UserLink } from "@/features/users/user-link";
import { useI18n } from "@/i18n/provider";
import { apiFetch, normalizeCollection, unwrap } from "@/lib/api/browser-client";

export interface InfoGroup { id: number; name: string; subject_name: string | null; faculty_name: string | null; is_active: boolean; members: number }
interface MemberRow { id: number; user: number; user_name: string; role: string; status: string }
interface GroupDetail { has_whatsapp_channel?: boolean; whatsapp_active?: boolean }

const ROLE_ORDER: Record<string, number> = { group_admin: 0, moderator: 1, member: 2 };

/** Side panel of the chat console: group info with WhatsApp status, members with roles, and the media/files seen in the thread. */
export function ChatInfoPanel({ group, messages, open, onOpenChange }: { group: InfoGroup; messages: readonly ChatMessage[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t, tOr } = useI18n();
  const members = useQuery({
    queryKey: ["chat-info-members", group.id],
    enabled: open,
    queryFn: async () => normalizeCollection<MemberRow>(await apiFetch(`${membersListPath(group.id, "members")}?status=approved&page_size=200`)),
  });
  const detail = useQuery({
    queryKey: ["chat-info-detail", group.id],
    enabled: open,
    queryFn: async () => unwrap<GroupDetail>(apiFetch(`/api/v1/dashboard/groups/${group.id}/`)),
  });
  const media = attachmentMessages(messages);
  const rows = [...(members.data?.results ?? [])].sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) || a.user_name.localeCompare(b.user_name));
  const whatsapp = detail.data?.has_whatsapp_channel === true;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-3 overflow-hidden sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{group.name}</SheetTitle>
          <SheetDescription>{t("chatConsole.infoSubtitle")}</SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="members" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="members" className="flex-1">{t("chatConsole.tabMembers")}</TabsTrigger>
            <TabsTrigger value="media" className="flex-1">{t("chatConsole.tabMedia")}</TabsTrigger>
            <TabsTrigger value="info" className="flex-1">{t("chatConsole.tabInfo")}</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="min-h-0 flex-1 overflow-y-auto">
            {members.isPending ? <Skeleton className="h-40 w-full" /> : members.isError ? <ErrorPanel error={members.error} retry={() => void members.refetch()} /> : rows.length === 0 ? <p className="p-3 text-sm text-muted-foreground">{t("chatConsole.noMembers")}</p> : (
              <ul className="divide-y">
                {rows.map((row) => (
                  <li key={row.id} className="flex items-center gap-3 py-2">
                    <SenderAvatar name={row.user_name} staff={row.role !== "member"} />
                    <UserLink userId={row.user} name={row.user_name} className="min-w-0 flex-1 truncate text-sm font-semibold" />
                    <span className="shrink-0 text-xs text-muted-foreground">{tOr(`enum.${row.role}`, row.role)}</span>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="media" className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            <p className="text-xs text-muted-foreground">{t("chatConsole.mediaHint")}</p>
            {media.length === 0 ? <p className="p-3 text-sm text-muted-foreground">{t("chatConsole.noMedia")}</p> : media.map((message) => <AttachmentChip key={message.id} groupId={group.id} message={message} />)}
          </TabsContent>

          <TabsContent value="info" className="min-h-0 flex-1 space-y-3 overflow-y-auto text-sm">
            <dl className="space-y-2">
              <Row label={t("chatConsole.infoSubject")} value={group.subject_name ?? "—"} />
              <Row label={t("chatConsole.infoFaculty")} value={group.faculty_name ?? "—"} />
              <Row label={t("chatConsole.infoMembers")} value={String(group.members)} />
              <div className="flex items-center justify-between gap-2 rounded-lg border p-3"><dt className="text-muted-foreground">{t("common.status")}</dt><dd><StatusPill value={group.is_active ? "active" : "inactive"} /></dd></div>
              <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
                <dt className="flex items-center gap-1.5 text-muted-foreground"><MessageCircle className="size-4" />{t("chatConsole.infoWhatsapp")}</dt>
                <dd>{detail.isPending ? <Skeleton className="h-5 w-16" /> : detail.isError ? "—" : <StatusPill value={whatsapp ? "enabled" : "disabled"} label={whatsapp ? t("chatConsole.whatsappLinked") : t("chatConsole.whatsappNone")} />}</dd>
              </div>
            </dl>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-2 rounded-lg border p-3"><dt className="text-muted-foreground">{label}</dt><dd className="font-semibold">{value}</dd></div>;
}
