"use client";

import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/config/constants";
import { safeDashboardPath, useInboxList, useInboxMutations, useInboxSummary, type InboxNotification } from "@/features/notifications/inbox";
import { useI18n } from "@/i18n/provider";
import { localizePath } from "@/i18n/routing";
import { formatDate, formatNumber } from "@/lib/utils";

/** The real bell: unread count, the latest notifications, one click to the page where the work is. */
export function NotificationBell() {
  const { t, locale } = useI18n();
  const params = useParams<{ locale: Locale }>();
  const router = useRouter();
  const summary = useInboxSummary();
  const list = useInboxList(null, 1, 8);
  const { markRead, markAllRead } = useInboxMutations();
  const unread = summary.data?.unread ?? 0;
  const badge = unread > 99 ? "99+" : formatNumber(unread, locale);

  const open = (item: InboxNotification) => {
    if (!item.is_read) markRead.mutate(item.id);
    router.push(localizePath(params.locale, safeDashboardPath(item.deep_link)));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? t("inbox.bellUnread", { count: formatNumber(unread, locale) }) : t("inbox.title")}>
          <Bell />
          {unread > 0 ? (
            <span className="absolute -end-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-5 text-white" aria-hidden="true">{badge}</span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] rounded-xl p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-4 py-3">
          <span>{t("inbox.title")}</span>
          <Button variant="ghost" size="sm" disabled={!unread || markAllRead.isPending} onClick={(event) => { event.preventDefault(); markAllRead.mutate(null); }}>
            <CheckCheck className="size-4" />{t("inbox.markAllRead")}
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-[22rem] overflow-y-auto p-1">
          {list.isPending ? <div className="space-y-2 p-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : null}
          {list.data?.results.map((item) => (
            <DropdownMenuItem key={item.id} onSelect={() => open(item)} className="flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2.5">
              <span className={item.is_read ? "mt-1.5 size-2 shrink-0 rounded-full bg-transparent" : "mt-1.5 size-2 shrink-0 rounded-full bg-primary"} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className={item.is_read ? "block truncate text-sm" : "block truncate text-sm font-bold"}>{item.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{item.body}</span>
                <span className="block text-[10px] text-muted-foreground">{formatDate(item.created_at, locale)}</span>
              </span>
            </DropdownMenuItem>
          ))}
          {list.data && !list.data.results.length ? <p className="p-6 text-center text-sm text-muted-foreground">{t("inbox.empty")}</p> : null}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem asChild className="justify-center rounded-none py-3 font-bold text-primary">
          <Link href={localizePath(params.locale, "/dashboard/inbox")}>{t("inbox.openAll")}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
