"use client";

import { ArrowUpRight, Keyboard } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/config/constants";
import { useQuickAccessCounts } from "@/features/notifications/inbox";
import { ATTENTION_ACTIONS, CREATE_ACTIONS, type QuickAction } from "@/features/quick-access/quick-actions";
import { useSession } from "@/features/session";
import { useI18n } from "@/i18n/provider";
import { localizePath } from "@/i18n/routing";
import { hasCapability } from "@/lib/auth/capabilities";
import { cn, formatNumber } from "@/lib/utils";

function Tile({ action, count, loading }: { action: QuickAction; count?: number; loading: boolean }) {
  const { t, locale } = useI18n();
  const params = useParams<{ locale: Locale }>();
  const Icon = action.icon;
  const waiting = (count ?? 0) > 0;
  return (
    <Link
      href={localizePath(params.locale, action.href)}
      className={cn("group flex items-center gap-3 rounded-2xl border p-3.5 transition hover:border-primary/40 hover:bg-accent/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary", waiting && "border-primary/30 bg-primary/5")}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{t(action.label)}</span>
        <span className="block truncate text-xs text-muted-foreground">{t(action.hint)}</span>
      </span>
      {action.count ? (
        loading ? <Skeleton className="h-6 w-8 rounded-full" /> : (
          <span className={cn("min-w-7 rounded-full px-2 py-0.5 text-center text-xs font-bold", waiting ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")} aria-label={t("quick.pendingCount", { count: formatNumber(count ?? 0, locale) })}>{formatNumber(count ?? 0, locale)}</span>
        )
      ) : <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition group-hover:opacity-100 rtl:-scale-x-100" />}
    </Link>
  );
}

/** Home panel: what is waiting for you (live counters) and the one-step creators, limited to what you may do. */
export function QuickAccessPanel() {
  const { t } = useI18n();
  const { capabilities } = useSession();
  const counts = useQuickAccessCounts();
  const attention = ATTENTION_ACTIONS.filter((action) => hasCapability(capabilities, action.capability));
  const create = CREATE_ACTIONS.filter((action) => hasCapability(capabilities, action.capability));
  if (!attention.length && !create.length) return null;
  return (
    <Card className="glass-panel">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>{t("quick.title")}</CardTitle>
          <CardDescription>{t("quick.subtitle")}</CardDescription>
        </div>
        <span className="hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs text-muted-foreground sm:flex"><Keyboard className="size-3.5" />Ctrl K · /</span>
      </CardHeader>
      <CardContent className="space-y-5">
        {attention.length ? (
          <section aria-labelledby="quick-attention">
            <h3 id="quick-attention" className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("quick.sectionAttention")}</h3>
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
              {attention.map((action) => <Tile key={action.key} action={action} count={action.count ? counts.data?.[action.count] : undefined} loading={counts.isPending} />)}
            </div>
          </section>
        ) : null}
        {create.length ? (
          <section aria-labelledby="quick-create">
            <h3 id="quick-create" className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("quick.sectionCreate")}</h3>
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
              {create.map((action) => <Tile key={action.key} action={action} loading={false} />)}
            </div>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
