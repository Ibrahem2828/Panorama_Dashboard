import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/formatters";

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
}

export function MetricCard({ title, value, icon: Icon, description }: MetricCardProps) {
  const display = typeof value === "number" ? formatNumber(value) : value;
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 text-2xl font-semibold">{display}</p>
            {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
          </div>
          <div className="rounded-md bg-primary/10 p-2 text-primary ring-1 ring-primary/15">
            <Icon className="size-5" aria-hidden="true" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
