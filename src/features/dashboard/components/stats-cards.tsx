import { FileCheck2, Files, LifeBuoy, Printer, Users, UserCheck, UserRoundCheck, UserRoundPlus, UsersRound } from "lucide-react";

import { MetricCard } from "@/components/shared/metric-card";
import type { DashboardStats } from "@/features/dashboard/types";

interface StatsCardsProps {
  stats?: DashboardStats;
}

function displayValue(v?: number) {
  return typeof v === "number" ? v : "—";
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    { title: "Total Users", value: displayValue(stats?.users?.total), icon: Users, description: "All registered users" },
    { title: "Students", value: displayValue(stats?.users?.students), icon: UserRoundPlus, description: "Student accounts" },
    { title: "Verified Students", value: displayValue(stats?.users?.verified_students), icon: UserCheck, description: "Approved profiles" },
    { title: "Pending Verifications", value: displayValue(stats?.users?.pending_verifications), icon: FileCheck2, description: "Awaiting review" },
    { title: "Total Groups", value: displayValue(stats?.groups?.total), icon: UsersRound, description: "Learning groups" },
    { title: "Pending Joins", value: displayValue(stats?.groups?.pending_join_requests), icon: UserRoundCheck, description: "Join requests" },
    { title: "Total Files", value: displayValue(stats?.files?.total), icon: Files, description: "Library files" },
    { title: "Today Print Orders", value: displayValue(stats?.printing?.today_orders), icon: Printer, description: "Submitted today" },
    { title: "Ready Print Orders", value: displayValue(stats?.printing?.ready_orders), icon: Printer, description: "Ready for pickup" },
    { title: "Open Support Tickets", value: displayValue(stats?.support?.open_tickets), icon: LifeBuoy, description: "Needs attention" },
    { title: "Urgent Tickets", value: displayValue(stats?.support?.urgent_tickets), icon: LifeBuoy, description: "Marked urgent" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <MetricCard key={card.title} {...card} />
      ))}
    </div>
  );
}
