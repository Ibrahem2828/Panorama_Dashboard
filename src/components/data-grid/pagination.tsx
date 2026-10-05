"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/i18n/provider";
import { formatNumber } from "@/lib/utils";

export function Pagination({ page, pageSize, count, onPage, onPageSize }: { page: number; pageSize: number; count: number; onPage: (page: number) => void; onPageSize: (size: number) => void }) {
  const { t, direction, locale } = useI18n();
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const Previous = direction === "rtl" ? ChevronRight : ChevronLeft;
  const Next = direction === "rtl" ? ChevronLeft : ChevronRight;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">{t("common.page")} {formatNumber(page, locale)} {t("common.of")} {formatNumber(pages, locale)} · {formatNumber(count, locale)}</div>
      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(value) => onPageSize(Number(value))}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{[10, 25, 50, 100].map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={t("common.previous")}><Previous /></Button>
        <Button variant="outline" size="icon" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={t("common.next")}><Next /></Button>
      </div>
    </div>
  );
}
