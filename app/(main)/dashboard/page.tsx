"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface DashboardData {
  diceCounts: { date: string; count: number }[];
  otherCounts: { date: string; count: number }[];
}

function DailyBidChart({ title, data, color }: { title: string; data: { date: string; count: number }[]; color: string }) {
  return (
    <div className="section-card space-y-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "oklch(0.708 0 0)" }}
            tickFormatter={(v: string) => new Date(v).toLocaleString("en-US", { weekday: "short", timeZone: "UTC" })}
          />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "oklch(0.708 0 0)" }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "oklch(0.205 0 0)", border: "1px solid oklch(1 0 0 / 10%)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "oklch(0.985 0 0)" }}
            itemStyle={{ color: "oklch(0.708 0 0)" }}
          />
          <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <div className="px-8 py-6 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
      </div>

      <div className="flex-1 px-8 py-6 space-y-6 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DailyBidChart title="Dice Bid Count — This Week" data={data.diceCounts} color="oklch(0.577 0.245 27.325)" />
          <DailyBidChart title="Other Bid Count — This Week" data={data.otherCounts} color="oklch(0.488 0.243 264.376)" />
        </div>
      </div>
    </div>
  );
}
