"use client";

import { Bell, BellRing, CheckCheck, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/config/constants";
import { safeDashboardPath, useInboxList, useInboxMutations, useInboxSummary, type InboxNotification } from "@/features/notifications/inbox";
import { playChime, useArrivalWatcher, useBrowserNotifications, useSoundPreference, useTitleBadge } from "@/features/notifications/live";
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
  const [soundOn, setSoundOn] = useSoundPreference();
  const browser = useBrowserNotifications();
  const badge = unread > 99 ? "99+" : formatNumber(unread, locale);

  useTitleBadge(unread);
  // Something new arrived while the dashboard was open: a toast (with a jump to the work), a soft chime, and an OS
  // notification only when the tab is in the background (the toast covers the visible case).
  useArrivalWatcher(list.data?.results, (item, batch) => {
    const link = localizePath(params.locale, safeDashboardPath(item.deep_link));
    toast(item.title, { description: item.body || undefined, action: { label: t("inbox.open"), onClick: () => router.push(link) } });
    if (item === batch[batch.length - 1] && soundOn) playChime();
    if (document.visibilityState === "hidden" && browser.permission === "granted") {
      try { new window.Notification(item.title, { body: item.body, tag: `panorama-${item.id}` }); } catch { /* the OS refused it */ }
    }
  });

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
        <div className="flex flex-col gap-0.5 p-1">
          <DropdownMenuItem className="cursor-pointer gap-2 rounded-lg px-3 py-2 text-xs" onSelect={(event) => { event.preventDefault(); setSoundOn(!soundOn); }} role="menuitemcheckbox" aria-checked={soundOn}>
            {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            {soundOn ? t("inbox.soundOn") : t("inbox.soundOff")}
          </DropdownMenuItem>
          {browser.permission === "default" ? (
            <DropdownMenuItem className="cursor-pointer gap-2 rounded-lg px-3 py-2 text-xs" onSelect={(event) => { event.preventDefault(); void browser.request(); }}>
              <BellRing className="size-4" />{t("inbox.enableBrowser")}
            </DropdownMenuItem>
          ) : null}
          {browser.permission === "granted" ? <p className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"><BellRing className="size-4" />{t("inbox.browserOn")}</p> : null}
          {browser.permission === "denied" ? <p className="px-3 py-2 text-xs text-muted-foreground">{t("inbox.browserDenied")}</p> : null}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem asChild className="justify-center rounded-none py-3 font-bold text-primary">
          <Link href={localizePath(params.locale, "/dashboard/inbox")}>{t("inbox.openAll")}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
