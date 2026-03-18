"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface HorizontalBarChartProps {
  title?: string;
  data: Record<string, unknown>[];
  dataKey: string;
  nameKey: string;
  height?: number;
  color?: string;
  maxItems?: number;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: Record<string, unknown> }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const label = String(
    item.payload[
      Object.keys(item.payload).find((k) => typeof item.payload[k] === "string") ?? "name"
    ] ?? ""
  );
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg max-w-xs">
      <p className="text-sm font-medium text-foreground break-words">{label}</p>
      <p className="text-sm text-muted-foreground">
        {item.name}:{" "}
        <span className="font-medium text-foreground">
          {typeof item.value === "number"
            ? item.value % 1 === 0
              ? item.value.toLocaleString()
              : item.value.toFixed(2) + "%"
            : item.value}
        </span>
      </p>
    </div>
  );
}

const COLORS = [
  "#6366f1", "#818cf8", "#a5b4fc", "#8b5cf6", "#a78bfa",
  "#c4b5fd", "#7c3aed", "#5b21b6", "#4f46e5", "#4338ca",
];

// Truncate long names for Y-axis labels
function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "..." : str;
}

export function HorizontalBarChart({
  title,
  data,
  dataKey,
  nameKey,
  height,
  color,
  maxItems = 20,
}: HorizontalBarChartProps) {
  const sorted = [...data]
    .sort((a, b) => (Number(b[dataKey]) || 0) - (Number(a[dataKey]) || 0))
    .slice(0, maxItems);

  const rowHeight = 32;
  const chartHeight = height ?? Math.max(200, sorted.length * rowHeight + 40);

  // Add truncated name for display
  const chartData = sorted.map((item) => ({
    ...item,
    _displayName: truncate(String(item[nameKey] ?? ""), 28),
  }));

  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {data.length > maxItems && (
            <CardDescription>Showing top {maxItems} of {data.length}</CardDescription>
          )}
        </CardHeader>
      )}
      <CardContent>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="_displayName"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
              tickLine={false}
              axisLine={false}
              width={180}
              interval={0}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey={dataKey} radius={[0, 4, 4, 0]} maxBarSize={24} barSize={20}>
              {chartData.map((_, index) => (
                <Cell key={index} fill={color ?? COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
