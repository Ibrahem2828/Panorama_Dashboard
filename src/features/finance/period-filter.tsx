"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { customRangeProblem, periodRange, type PeriodPreset, type PeriodRange } from "@/features/finance/finance-rules";
import { useI18n } from "@/i18n/provider";

const PRESETS: readonly PeriodPreset[] = ["today", "week", "month", "custom"];

export interface PeriodState {
  preset: PeriodPreset;
  setPreset: (preset: PeriodPreset) => void;
  custom: PeriodRange;
  setCustom: (range: PeriodRange) => void;
  /** The from/to to send (YYYY-MM-DD). */
  range: PeriodRange;
  /** Custom range problem, or null when the range is usable. */
  problem: "incomplete" | "order" | null;
}

/** Period selection (today / this week / this month / custom range) for the finance screens. */
export function usePeriod(initial: PeriodPreset = "month"): PeriodState {
  const [preset, setPreset] = useState<PeriodPreset>(initial);
  const [custom, setCustom] = useState<PeriodRange>({ from: "", to: "" });
  const range = useMemo(() => periodRange(preset, new Date(), custom), [preset, custom]);
  const problem = preset === "custom" ? customRangeProblem(custom.from, custom.to) : null;
  return { preset, setPreset, custom, setCustom, range, problem };
}

export function PeriodFilter({ period }: { period: PeriodState }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div role="group" aria-label={t("finance.period.label")} className="inline-flex rounded-lg border bg-muted/40 p-1">
        {PRESETS.map((preset) => (
          <Button key={preset} type="button" size="sm" variant={period.preset === preset ? "default" : "ghost"} aria-pressed={period.preset === preset} onClick={() => period.setPreset(preset)}>
            {t(`finance.period.${preset}` as "finance.period.today")}
          </Button>
        ))}
      </div>
      {period.preset === "custom" ? (
        <>
          <div className="space-y-1">
            <Label htmlFor="period-from" className="text-xs text-muted-foreground">{t("finance.period.from")}</Label>
            <Input id="period-from" type="date" className="h-9 w-40" value={period.custom.from} max={period.custom.to || undefined} onChange={(event) => period.setCustom({ ...period.custom, from: event.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="period-to" className="text-xs text-muted-foreground">{t("finance.period.to")}</Label>
            <Input id="period-to" type="date" className="h-9 w-40" value={period.custom.to} min={period.custom.from || undefined} onChange={(event) => period.setCustom({ ...period.custom, to: event.target.value })} />
          </div>
          {period.problem ? <p role="alert" className="pb-2 text-xs font-medium text-destructive">{t(period.problem === "order" ? "finance.period.orderError" : "finance.period.incomplete")}</p> : null}
        </>
      ) : null}
    </div>
  );
}
