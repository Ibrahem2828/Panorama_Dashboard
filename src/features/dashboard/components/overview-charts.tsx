"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { StatChartCard } from "@/components/charts/stat-chart-card";
import type { DashboardStats } from "@/features/dashboard/types";

interface OverviewChartsProps {
  stats?: DashboardStats;
}

const colors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export function OverviewCharts({ stats }: OverviewChartsProps) {
  const userData = [
    { name: "Students", value: stats?.users?.students ?? 0 },
    { name: "Normal Users", value: stats?.users?.normal_users ?? 0 },
    { name: "Verified", value: stats?.users?.verified_students ?? 0 },
  ];

  const printData = [
    { name: "Pending", value: stats?.printing?.pending_orders ?? 0 },
    { name: "Ready", value: stats?.printing?.ready_orders ?? 0 },
    { name: "Delivered", value: stats?.printing?.delivered_orders ?? 0 },
  ];

  const supportData = [
    { name: "Open", value: stats?.support?.open_tickets ?? 0 },
    { name: "Urgent", value: stats?.support?.urgent_tickets ?? 0 },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <StatChartCard title="User Distribution" description="Account mix by role and status">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={userData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                {userData.map((entry, index) => (
                  <Cell key={entry.name} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </StatChartCard>
      <StatChartCard title="Print Orders" description="Current operational status">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={printData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="hsl(var(--chart-1))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </StatChartCard>
      <StatChartCard title="Support Tickets" description="Support queue health">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={supportData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="hsl(var(--chart-2))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </StatChartCard>
    </div>
  );
}
