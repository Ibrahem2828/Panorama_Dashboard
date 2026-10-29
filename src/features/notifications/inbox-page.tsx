"use client";

import { CheckCheck } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { Pagination } from "@/components/data-grid/pagination";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/config/constants";
import { safeDashboardPath, useInboxList, useInboxMutations, useInboxSummary, visibleInboxCategories, type InboxNotification } from "@/features/notifications/inbox";
import { useI18n } from "@/i18n/provider";
import { localizePath } from "@/i18n/routing";
import { cn, formatDate, formatNumber } from "@/lib/utils";

/** The staff inbox: everything addressed to you, grouped by what it is about, with one click to the work. */
export function InboxPage() {
  const { t, locale } = useI18n();
  const params = useParams<{ locale: Locale }>();
  const router = useRouter();
  const [category, setCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const list = useInboxList(category, page, 25);
  const summary = useInboxSummary();
  const { markRead, markAllRead } = useInboxMutations();
  const byCategory = summary.data?.by_category ?? {};

  const open = (item: InboxNotification) => {
    if (!item.is_read) markRead.mutate(item.id);
    router.push(localizePath(params.locale, safeDashboardPath(item.deep_link)));
  };
  const tabs: { key: string | null; label: string; count: number }[] = [
    { key: null, label: t("common.all"), count: summary.data?.unread ?? 0 },
    ...visibleInboxCategories(summary.data?.by_category).map((key) => ({ key, label: t(`inbox.category.${key}` as "inbox.category.general"), count: byCategory[key] ?? 0 })),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("inbox.title")}
        description={t("inbox.subtitle")}
        actions={<Button variant="outline" disabled={markAllRead.isPending || !(category ? byCategory[category] : summary.data?.unread)} onClick={() => markAllRead.mutate(category)}><CheckCheck />{t("inbox.markAllRead")}</Button>}
      />
      <div role="tablist" aria-label={t("inbox.title")} className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Button key={tab.key ?? "all"} role="tab" aria-selected={category === tab.key} size="sm" variant={category === tab.key ? "default" : "outline"} onClick={() => { setCategory(tab.key); setPage(1); }}>
            {tab.label}
            {tab.count > 0 ? <span className="ms-1.5 rounded-full bg-background/20 px-1.5 text-[11px] font-bold">{formatNumber(tab.count, locale)}</span> : null}
          </Button>
        ))}
      </div>
      {list.isPending ? <Skeleton className="h-64 rounded-2xl" /> : list.isError ? <ErrorPanel error={list.error} retry={() => list.refetch()} /> : (
        <Card className="divide-y overflow-hidden">
          {list.data.results.map((item) => (
            <button key={item.id} type="button" onClick={() => open(item)} className={cn("flex w-full items-start gap-3 px-4 py-3.5 text-start transition hover:bg-accent/60", !item.is_read && "bg-primary/5")}>
              <span className={cn("mt-2 size-2.5 shrink-0 rounded-full", item.is_read ? "bg-transparent" : "bg-primary")} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={cn("truncate", !item.is_read && "font-bold")}>{item.title}</span>
                  {item.category ? <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">{t(`inbox.category.${item.category}` as "inbox.category.general")}</span> : null}
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{item.body}</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">{formatDate(item.created_at, locale)}</span>
              </span>
              {!item.is_read ? <span className="sr-only">{t("inbox.unread")}</span> : null}
            </button>
          ))}
          {!list.data.results.length ? <p className="p-10 text-center text-sm text-muted-foreground">{t("inbox.empty")}</p> : null}
        </Card>
      )}
      {list.data ? <Pagination page={page} pageSize={25} count={list.data.count} onPage={setPage} onPageSize={() => undefined} /> : null}
    </div>
  );
}
