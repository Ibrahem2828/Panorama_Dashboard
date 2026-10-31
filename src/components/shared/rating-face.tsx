"use client";

import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export type RatingValue = 1 | 2 | 3 | 4 | 5;
export const RATING_VALUES: readonly RatingValue[] = [1, 2, 3, 4, 5];

/** Red -> orange -> yellow -> light green -> green. Facial features are dark so they read on every fill, in light and dark themes. */
const FILL: Record<RatingValue, string> = { 1: "#ef4444", 2: "#f97316", 3: "#eab308", 4: "#84cc16", 5: "#22c55e" };
const MOUTH: Record<RatingValue, string> = {
  1: "M7.5 17c1.2-2.6 7.8-2.6 9 0",
  2: "M8 16.5c1.3-1.4 6.7-1.4 8 0",
  3: "M8 16h8",
  4: "M8 15c1.3 1.7 6.7 1.7 8 0",
  5: "M7 14.2c.9 3.6 9.1 3.6 10 0z",
};

/** Normalises an API value (number or numeric string) to 1..5, or null when it is not a usable rating. */
export function toRatingValue(value: unknown): RatingValue | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Math.round(Number(value));
  return number >= 1 && number <= 5 ? (number as RatingValue) : null;
}

export function ratingMessageKey(value: RatingValue) {
  return `rating.face.${value}` as const;
}

interface RatingFaceProps {
  value: unknown;
  /** Show the word beside the face. */
  showLabel?: boolean;
  size?: number;
  className?: string;
}

export function RatingFaceIcon({ value, size = 24, className }: { value: RatingValue; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" className={cn("shrink-0", className)} data-rating={value}>
      <circle cx="12" cy="12" r="10.5" fill={FILL[value]} stroke="#1f2937" strokeOpacity="0.35" strokeWidth="1" />
      {value === 1 ? <path d="M6.8 8.2l3-1M17.2 8.2l-3-1" stroke="#1f2937" strokeWidth="1.4" strokeLinecap="round" fill="none" /> : null}
      <circle cx="8.6" cy="10" r="1.3" fill="#1f2937" />
      <circle cx="15.4" cy="10" r="1.3" fill="#1f2937" />
      <path d={MOUTH[value]} stroke="#1f2937" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill={value === 5 ? "#1f2937" : "none"} />
    </svg>
  );
}

export function RatingFace({ value, showLabel = true, size = 24, className }: RatingFaceProps) {
  const { t } = useI18n();
  const rating = toRatingValue(value);
  if (!rating) return <span className={className} aria-label={t("rating.none")}>—</span>;
  const word = t(ratingMessageKey(rating));
  return (
    <span role="img" aria-label={t("rating.aria", { word, value: rating })} title={word} className={cn("inline-flex items-center gap-2", className)} data-testid="rating-face">
      <RatingFaceIcon value={rating} size={size} />
      {showLabel ? <span className="text-sm font-semibold" aria-hidden="true">{word}</span> : null}
    </span>
  );
}
