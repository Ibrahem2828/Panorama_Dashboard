import Link from "next/link";

import { Button } from "@/components/ui/button";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  breadcrumbs?: BreadcrumbItem[];
}

export function PageHeader({ title, description, actionLabel, actionHref, onAction, breadcrumbs }: PageHeaderProps) {
  const action =
    actionLabel && actionHref ? (
      <Button asChild>
        <Link href={actionHref}>{actionLabel}</Link>
      </Button>
    ) : actionLabel ? (
      <Button onClick={onAction} disabled={!onAction}>
        {actionLabel}
      </Button>
    ) : null;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        {breadcrumbs?.length ? (
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            {breadcrumbs.map((item, index) => (
              <span key={item.label}>
                {item.href ? (
                  <Link className="hover:text-foreground" href={item.href}>
                    {item.label}
                  </Link>
                ) : (
                  <span>{item.label}</span>
                )}
                {index < breadcrumbs.length - 1 ? <span className="mx-2">/</span> : null}
              </span>
            ))}
          </nav>
        ) : null}
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
          {description ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}
