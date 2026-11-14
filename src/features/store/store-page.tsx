"use client";

import { AlertTriangle, CalendarClock, ClipboardList, Eye, PackageCheck, PackageOpen, Sparkles, Star, Store, Tag } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { CapabilityGate } from "@/components/feedback/capability-gate";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StoreOrdersPanel } from "@/features/store/orders-panel";
import { CatalogPanel } from "@/features/store/products-panel";
import { StoreReviewsPanel } from "@/features/store/reviews-panel";
import { StockBadge } from "@/features/store/store-ui";
import { STORE_TABS, openOrdersCount, stockLevel, storeTabHref, type StoreTab } from "@/features/store/store-rules";
import { useStoreSummary } from "@/features/store/use-store-summary";
import { useI18n } from "@/i18n/provider";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { cn } from "@/lib/utils";

function Counter({ href, icon, label, value, tone }: { href: string; icon: ReactNode; label: string; value: number | null; tone?: "warn" | "danger" }) {
  const highlighted = value !== null && value > 0 && tone;
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-w-0 items-center gap-3 rounded-2xl border bg-card p-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        highlighted && tone === "warn" && "border-amber-500/40 bg-amber-500/10",
        highlighted && tone === "danger" && "border-red-500/40 bg-red-500/10",
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">{icon}</span>
      <span className="min-w-0">
        <span className="block text-2xl font-black leading-none tabular-nums"><bdi>{value ?? "—"}</bdi></span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">{label}</span>
      </span>
    </Link>
  );
}

/** The numbers the shop owner wants first: orders by status, today's orders and what is about to run out. */
export function StoreSummaryWidget() {
  const { t, locale } = useI18n();
  const summary = useStoreSummary();
  if (summary.isPending) return <Skeleton className="h-64 rounded-2xl" />;
  if (summary.isError) return <ErrorPanel error={summary.error} retry={() => void summary.refetch()} />;
  const data = summary.data;
  const by = data.orders_by_status;
  const orders = (status: string) => storeTabHref(locale, "orders", { status });
  return (
    <div className="space-y-4">
      <section aria-label={t("store.summary.title")} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
        <Counter href={orders("pending")} icon={<Sparkles className="size-5" />} label={t("store.status.pending")} value={by.pending ?? 0} tone="warn" />
        <Counter href={orders("confirmed")} icon={<ClipboardList className="size-5" />} label={t("store.status.confirmed")} value={by.confirmed ?? 0} />
        <Counter href={orders("ready_for_pickup")} icon={<PackageOpen className="size-5" />} label={t("store.status.ready_for_pickup")} value={by.ready_for_pickup ?? 0} />
        <Counter href={orders("picked_up")} icon={<PackageCheck className="size-5" />} label={t("store.status.picked_up")} value={by.picked_up ?? 0} />
        <Counter href={storeTabHref(locale, "orders")} icon={<CalendarClock className="size-5" />} label={t("store.summary.today")} value={data.orders_today} />
        <Counter href={storeTabHref(locale, "products")} icon={<Tag className="size-5" />} label={t("store.summary.activeProducts")} value={data.products_active} />
        <Counter href={storeTabHref(locale, "reviews", { hidden: "hidden" })} icon={<Eye className="size-5" />} label={t("store.summary.hiddenReviews")} value={data.reviews_hidden} />
        <Counter href={storeTabHref(locale, "products")} icon={<AlertTriangle className="size-5" />} label={t("store.summary.lowStockCount")} value={data.low_stock.length} tone="warn" />
      </section>

      <section className="rounded-2xl border bg-card" aria-labelledby="store-low-stock">
        <div className="flex items-center justify-between gap-3 border-b p-4">
          <h2 id="store-low-stock" className="text-base font-black">{t("store.summary.lowStock")}</h2>
          <span className="text-xs text-muted-foreground">{t("store.summary.lowStockHint")}</span>
        </div>
        {data.low_stock.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">{t("store.summary.lowStockNone")}</p> : (
          <ul className="divide-y">
            {data.low_stock.map((entry) => (
              <li key={entry.variant}>
                <Link href={storeTabHref(locale, "products", { variant: entry.variant })} className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                  <span className="min-w-0"><span className="block font-semibold" dir="auto">{String(entry.product)}</span>{entry.label ? <span className="text-xs text-muted-foreground" dir="auto">{entry.label}</span> : null}</span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    {entry.reorder_level > 0 ? <span>{t("store.summary.reorderAt", { level: entry.reorder_level })}</span> : null}
                    <StockBadge stock={entry.available} level={stockLevel(entry.available, entry.reorder_level)} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TabNav({ active }: { active: StoreTab }) {
  const { t, locale } = useI18n();
  const summary = useStoreSummary();
  const labels: Record<StoreTab, string> = { overview: t("store.tab.overview"), orders: t("store.tab.orders"), products: t("store.tab.products"), reviews: t("store.tab.reviews") };
  const open = openOrdersCount(summary.data);
  return (
    <nav aria-label={t("store.title")} className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
      {STORE_TABS.map((tab) => (
        <Link
          key={tab}
          href={storeTabHref(locale, tab)}
          aria-current={tab === active ? "page" : undefined}
          className={cn("inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {tab === "orders" ? <ClipboardList className="size-4" aria-hidden="true" /> : tab === "products" ? <Tag className="size-4" aria-hidden="true" /> : tab === "reviews" ? <Star className="size-4" aria-hidden="true" /> : <Store className="size-4" aria-hidden="true" />}
          {labels[tab]}
          {tab === "orders" && open > 0 ? <span className="rounded-full bg-amber-500/20 px-1.5 text-xs tabular-nums text-amber-800 dark:text-amber-200"><bdi>{open}</bdi></span> : null}
        </Link>
      ))}
    </nav>
  );
}

/** The shell of every store screen: header, section navigation and the screen itself, behind the `store.manage` gate. */
export function StorePage({ tab }: { tab: StoreTab }) {
  const { t } = useI18n();
  const description: Record<StoreTab, string> = { overview: t("store.subtitle"), orders: t("store.orders.subtitle"), products: t("store.products.subtitle"), reviews: t("store.reviews.subtitle") };
  return (
    <CapabilityGate capability={CAPABILITIES.store}>
      <div className="space-y-6">
        <PageHeader title={tab === "overview" ? t("store.title") : t(`store.tab.${tab}` as "store.tab.orders")} description={description[tab]} eyebrow={tab === "overview" ? t("nav.operations") : t("store.title")} />
        <TabNav active={tab} />
        <Suspense fallback={<Skeleton className="h-72 rounded-2xl" />}>
          {tab === "overview" ? <StoreSummaryWidget /> : tab === "orders" ? <StoreOrdersPanel /> : tab === "products" ? <CatalogPanel /> : <StoreReviewsPanel />}
        </Suspense>
      </div>
    </CapabilityGate>
  );
}
