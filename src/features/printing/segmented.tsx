"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

/**
 * A group of mutually exclusive choices drawn as large touch-friendly buttons (a radio group underneath: one tab stop,
 * arrow keys move the choice). The buttons wrap onto new rows instead of shrinking, so labels never overlap or clip.
 */
export function Segmented<T extends string>({ label, value, options, onChange, minItemRem = 7, className }: {
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  /** Narrowest a button may get before the row wraps. */
  minItemRem?: number;
  className?: string;
}) {
  const group = useRef<HTMLDivElement>(null);
  const labelId = useId();

  function move(step: 1 | -1) {
    const index = options.findIndex((option) => option.value === value);
    const next = options[(index + step + options.length) % options.length];
    if (!next) return;
    onChange(next.value);
    // Move the focus with the choice so a keyboard user keeps their place.
    window.requestAnimationFrame(() => group.current?.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus());
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const rtl = group.current ? getComputedStyle(group.current).direction === "rtl" : false;
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const backward = rtl ? "ArrowRight" : "ArrowLeft";
    if (event.key === "ArrowDown" || event.key === forward) { event.preventDefault(); move(1); }
    else if (event.key === "ArrowUp" || event.key === backward) { event.preventDefault(); move(-1); }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p id={labelId} className="text-sm font-semibold">{label}</p>
      <div
        ref={group}
        role="radiogroup"
        aria-labelledby={labelId}
        onKeyDown={onKeyDown}
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${minItemRem}rem, 1fr))` }}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              data-value={option.value}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-center text-sm font-semibold leading-5 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                selected ? "border-primary bg-primary/10 text-primary shadow-sm" : "border-border bg-card text-foreground/80 hover:border-primary/40 hover:bg-muted/50",
              )}
            >
              {option.icon ? <span className="shrink-0" aria-hidden="true">{option.icon}</span> : null}
              <span className="min-w-0 break-words">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A label, the control, and an optional hint or error below it, with fixed spacing so fields never touch. */
export function Field({ label, htmlFor, hint, error, optional, children, className }: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  optional?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
        {label}
        {optional ? <span className="text-xs font-normal text-muted-foreground">({optional})</span> : null}
      </label>
      {children}
      {error ? <p role="alert" className="text-xs font-medium text-destructive">{error}</p> : hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
