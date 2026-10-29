"use client";

import { AlertTriangle, CheckCircle2, ClipboardList, Hourglass, ListOrdered, PackageX, Printer as PrinterIcon, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";

import { CapabilityGate } from "@/components/feedback/capability-gate";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CounterOrderTab } from "@/features/printing/counter-order-page";
import { JobQueuePanel } from "@/features/printing/job-queue-panel";
import { PrintOrdersPanel } from "@/features/printing/orders-panel";
import { PricingSimulator } from "@/features/printing/pricing-simulator";
import { CATALOG_SECTIONS, resolveCopyFrom, resolveSection, resolveTab, tabHref, type PrintingTab } from "@/features/printing/printing-home-rules";
import { PrintersPanel } from "@/features/printing/printers-panel";
import { usePrintingCounters } from "@/features/printing/use-printing-counters";
import { RESOURCE_COLUMNS } from "@/features/resources/columns";
import { ResourceManager, type ManagerFilter } from "@/features/resources/resource-manager";
import { useI18n } from "@/i18n/provider";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { cn } from "@/lib/utils";

const CURRENCIES = ["SYP", "USD"] as const;

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
        <span className="block text-2xl font-black leading-none tabular-nums">{value ?? "—"}</span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">{label}</span>
      </span>
    </Link>
  );
}

/** The numbers a shop supervisor wants first, each one a shortcut to the screen where it is handled. */
function OperationsStrip() {
  const { t, locale } = useI18n();
  const counters = usePrintingCounters();
  const orders = (value: number) => (counters.ordersReady ? value : null);
  const jobs = (value: number | undefined) => (counters.jobsReady ? value ?? 0 : null);
  return (
    <section aria-label={t("printing.strip.title")} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Counter href={tabHref(locale, "orders", { status: "submitted" })} icon={<Sparkles className="size-5" />} label={t("printing.strip.new")} value={orders(counters.stages.new)} tone="warn" />
      <Counter href={tabHref(locale, "orders", { status: "printing" })} icon={<PrinterIcon className="size-5" />} label={t("printing.strip.inProgress")} value={orders(counters.stages.inProgress)} />
      <Counter href={tabHref(locale, "orders", { status: "ready" })} icon={<CheckCircle2 className="size-5" />} label={t("printing.strip.ready")} value={orders(counters.stages.ready)} />
      <Counter href={tabHref(locale, "queue", { jstatus: "queued" })} icon={<Hourglass className="size-5" />} label={t("printing.strip.jobsWaiting")} value={jobs((counters.jobs.queued ?? 0) + (counters.jobs.printing ?? 0))} />
      <Counter href={tabHref(locale, "queue", { jstatus: "failed" })} icon={<AlertTriangle className="size-5" />} label={t("printing.strip.jobsFailed")} value={jobs(counters.jobs.failed)} tone="danger" />
      <Counter href={`/${locale}/dashboard/finance/stock`} icon={<PackageX className="size-5" />} label={t("printing.strip.lowStock")} value={counters.lowStock} tone="warn" />
    </section>
  );
}

function CatalogTab({ section, onSection }: { section: ReturnType<typeof resolveSection>; onSection: (value: string) => void }) {
  const { t, enumLabel } = useI18n();
  const currencyFilter = (clientSide: boolean): ManagerFilter[] => [{ param: "currency", label: t("printing.currencyFilter"), clientSide, options: CURRENCIES.map((value) => ({ value, label: enumLabel(value) })) }];
  const labels: Record<(typeof CATALOG_SECTIONS)[number], string> = {
    pricing: t("printing.pricing"), binding: t("printing.binding"), covers: t("printing.covers"), wire: t("printing.wire"), products: t("printing.products"), simulator: t("printing.simulator"),
  };
  return (
    <Tabs value={section} onValueChange={onSection} className="space-y-4">
      <TabsList aria-label={t("printing.catalogSections")} className="h-auto flex-wrap justify-start">
        {CATALOG_SECTIONS.map((value) => <TabsTrigger key={value} value={value}>{labels[value]}</TabsTrigger>)}
      </TabsList>
      <TabsContent value="pricing"><ResourceManager resourceKey="printing-pricing-rules" columns={RESOURCE_COLUMNS["printing-pricing-rules"]} title={t("printing.pricing")} capability={CAPABILITIES.printing} filters={currencyFilter(false)} /></TabsContent>
      <TabsContent value="binding"><ResourceManager resourceKey="printing-binding-prices" columns={RESOURCE_COLUMNS["printing-binding-prices"]} title={t("printing.binding")} capability={CAPABILITIES.printing} filters={currencyFilter(true)} /></TabsContent>
      <TabsContent value="covers"><ResourceManager resourceKey="printing-covers" columns={RESOURCE_COLUMNS["printing-covers"]} title={t("printing.covers")} capability={CAPABILITIES.printing} filters={currencyFilter(true)} /></TabsContent>
      <TabsContent value="wire"><ResourceManager resourceKey="printing-wire-specs" columns={RESOURCE_COLUMNS["printing-wire-specs"]} title={t("printing.wire")} capability={CAPABILITIES.printing} /></TabsContent>
      <TabsContent value="products"><ResourceManager resourceKey="printing-products" columns={RESOURCE_COLUMNS["printing-products"]} title={t("printing.products")} capability={CAPABILITIES.printing} /></TabsContent>
      <TabsContent value="simulator"><PricingSimulator /></TabsContent>
    </Tabs>
  );
}

function PrintingWorkspace() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = resolveTab(searchParams.get("tab"));
  const section = resolveSection(searchParams.get("section"));
  const urlCopyFrom = resolveCopyFrom(searchParams.get("from"));
  // The order being copied is remembered while the cashier looks at another tab, so the half-filled form is not rebuilt on return.
  const [copy, setCopy] = useState<{ id: number | null; nonce: number; seen: number | null }>({ id: urlCopyFrom, nonce: 0, seen: urlCopyFrom });
  if (copy.seen !== urlCopyFrom) setCopy({ id: urlCopyFrom ?? copy.id, nonce: urlCopyFrom !== null ? copy.nonce + 1 : copy.nonce, seen: urlCopyFrom });

  /** Changes parameters of the current tab and keeps the rest (filters, page, the open order). */
  const updateUrl = useCallback((changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, String(value));
    }
    router.replace(`?${next.toString()}`, { scroll: false });
  }, [router, searchParams]);

  // Moving to another tab starts it clean: filters and pages of the previous tab must not leak into it.
  const goTab = (next: string) => router.replace(`?tab=${resolveTab(next)}`, { scroll: false });

  const jobStatus = searchParams.get("jstatus") ?? "all";
  const tabs: { value: PrintingTab; label: string; icon?: ReactNode }[] = [
    { value: "orders", label: t("printing.tab.orders"), icon: <ClipboardList className="size-4" /> },
    { value: "queue", label: t("printing.tab.queue"), icon: <ListOrdered className="size-4" /> },
    { value: "counter", label: t("printing.tab.counter"), icon: <Sparkles className="size-4" /> },
    { value: "catalog", label: t("printing.tab.catalog") },
    { value: "printers", label: t("printing.tab.printers"), icon: <PrinterIcon className="size-4" /> },
    { value: "locations", label: t("printing.tab.locations") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("printing.title")} description={t("printing.subtitle")} eyebrow={t("nav.operations")} />
      <OperationsStrip />
      <Tabs value={tab} onValueChange={goTab} className="space-y-4">
        <TabsList aria-label={t("printing.title")} className="h-auto w-full flex-wrap justify-start gap-1">
          {tabs.map((item) => <TabsTrigger key={item.value} value={item.value} className="gap-2 px-4 py-2">{item.icon}{item.label}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="orders"><PrintOrdersPanel /></TabsContent>
        <TabsContent value="queue">
          <JobQueuePanel
            status={jobStatus}
            orderFilter={searchParams.get("jorder") ?? ""}
            page={Math.max(1, Number(searchParams.get("page") ?? 1))}
            pageSize={Math.min(100, Math.max(10, Number(searchParams.get("page_size") ?? 25)))}
            onChange={updateUrl}
          />
        </TabsContent>
        {/* Kept mounted while hidden, so a half-typed counter order survives a glance at another tab. */}
        <TabsContent value="counter" forceMount className="data-[state=inactive]:hidden"><CounterOrderTab key={copy.nonce} copyFrom={copy.id} /></TabsContent>
        <TabsContent value="catalog"><CatalogTab section={section} onSection={(value) => updateUrl({ section: value })} /></TabsContent>
        <TabsContent value="printers"><PrintersPanel /></TabsContent>
        <TabsContent value="locations"><ResourceManager resourceKey="printing-pickup-locations" columns={RESOURCE_COLUMNS["printing-pickup-locations"]} title={t("printing.locations")} capability={CAPABILITIES.printing} /></TabsContent>
      </Tabs>
    </div>
  );
}

export function PrintingPage() {
  return (
    <CapabilityGate capability={CAPABILITIES.printing}>
      <PrintingWorkspace />
    </CapabilityGate>
  );
}
