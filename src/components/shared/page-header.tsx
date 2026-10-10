"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Breadcrumb = { label: string; href?: string };

export function PageHeader({ title, description, eyebrow, actions, actionLabel, onAction, breadcrumbs, className }: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  actionLabel?: string;
  onAction?: () => void | Promise<unknown>;
  breadcrumbs?: Breadcrumb[];
  className?: string;
}) {
  const action = actions ?? (actionLabel ? <Button type="button" variant="outline" onClick={() => void onAction?.()}>{actionLabel}</Button> : null);
  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-start md:justify-between", className)}>
      <div className="min-w-0">
        {breadcrumbs?.length ? <div className="mb-2 text-xs text-muted-foreground">{breadcrumbs.map((item) => item.label).join(" / ")}</div> : null}
        {eyebrow ? <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</div> : null}
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}
