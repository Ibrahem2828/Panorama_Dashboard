"use client";

import { useEffect, useState } from "react";

/**
 * A route transition is intentionally invisible for the first 150ms. Slower
 * transitions receive a page-shaped skeleton rather than a blocking spinner.
 */
export function RouteLoader({ label = "Loading" }: { label?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 150);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="mx-auto w-full max-w-[var(--app-content-max-width)] px-3 py-5 sm:px-5 sm:py-7 lg:px-8" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="space-y-7" aria-hidden="true">
        <div className="space-y-3">
          <div className="h-3 w-24 animate-pulse rounded-full bg-primary/15" />
          <div className="h-9 w-[min(22rem,82vw)] animate-pulse rounded-xl bg-muted" />
          <div className="h-4 w-[min(40rem,92vw)] animate-pulse rounded-full bg-muted/80" />
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.55fr_.75fr]">
          <div className="h-56 animate-pulse rounded-2xl bg-muted" />
          <div className="h-56 animate-pulse rounded-2xl bg-muted/80" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-muted/80" />)}
        </div>
      </div>
    </div>
  );
}