"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RATING_VALUES, type RatingValue, RatingFace, RatingFaceIcon, toRatingValue } from "@/components/shared/rating-face";
import { useI18n } from "@/i18n/provider";
import { formatNumber } from "@/lib/utils";

/** Keys of the analytics payload that the summary card already shows (kept out of the generic metric cards). */
export const RATING_SUMMARY_KEYS = ["average_rating", "total_ratings"];

export function ratingDistribution(raw: unknown): Record<RatingValue, number> {
  const out: Record<RatingValue, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (raw && typeof raw === "object") {
    for (const [key, count] of Object.entries(raw as Record<string, unknown>)) {
      const value = toRatingValue(key);
      const number = Number(count);
      if (value && Number.isFinite(number)) out[value] += number;
    }
  }
  return out;
}

export function RatingSummary({ average, total, distribution }: { average: unknown; total: unknown; distribution: unknown }) {
  const { t, locale } = useI18n();
  const avg = average === null || average === undefined ? Number.NaN : Number(average);
  const count = Number(total);
  const dist = ratingDistribution(distribution);
  const distTotal = RATING_VALUES.reduce((sum, value) => sum + dist[value], 0);
  const hasAverage = Number.isFinite(avg) && avg > 0;
  const rounded = hasAverage ? Math.round(avg * 10) / 10 : null;
  if (!hasAverage && !distTotal) return null;
  return (
    <Card data-testid="rating-summary">
      <CardHeader className="pb-2"><CardDescription>{t("rating.average")}</CardDescription></CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-[auto_1fr] md:items-center">
        <div className="flex items-center gap-3">
          {rounded !== null ? <RatingFace value={rounded} showLabel={false} size={48} /> : null}
          <div>
            <CardTitle className="text-3xl" data-testid="rating-average">{rounded !== null ? formatNumber(rounded.toFixed(1), locale) : "—"}</CardTitle>
            {Number.isFinite(count) ? <p className="text-xs text-muted-foreground">{t("rating.responses", { count: formatNumber(count, locale) })}</p> : null}
          </div>
        </div>
        {distTotal ? (
          <ul className="space-y-1.5" aria-label={t("rating.distribution")}>
            {[...RATING_VALUES].reverse().map((value) => {
              const percent = Math.round((dist[value] / distTotal) * 100);
              return (
                <li key={value} className="flex items-center gap-3 text-xs" data-testid={`rating-dist-${value}`}>
                  <span className="flex w-28 shrink-0 items-center gap-2"><RatingFaceIcon value={value} size={20} /><span>{t(`rating.face.${value}`)}</span></span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true"><span className="block h-full rounded-full bg-primary/70" style={{ width: `${percent}%` }} /></span>
                  <span className="w-10 text-end tabular-nums text-muted-foreground">{formatNumber(dist[value], locale)}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
