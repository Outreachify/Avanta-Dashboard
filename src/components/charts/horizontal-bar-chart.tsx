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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface HorizontalBarChartProps {
  title?: string;
  data: Record<string, unknown>[];
  dataKey: string;
  nameKey: string;
  height?: number;
  color?: string;
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
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-sm font-medium text-foreground">
        {String(item.payload[Object.keys(item.payload).find((k) => typeof item.payload[k] === "string") ?? "name"] ?? "")}
      </p>
      <p className="text-sm text-muted-foreground">
        {item.name}: <span className="font-medium text-foreground">{typeof item.value === "number" ? item.value.toLocaleString() : item.value}</span>
      </p>
    </div>
  );
}

const COLORS = [
  "#6366f1",
  "#818cf8",
  "#a5b4fc",
  "#c7d2fe",
  "#8b5cf6",
  "#a78bfa",
  "#c4b5fd",
  "#7c3aed",
  "#5b21b6",
  "#4f46e5",
];

export function HorizontalBarChart({
  title,
  data,
  dataKey,
  nameKey,
  height,
  color,
}: HorizontalBarChartProps) {
  const sorted = [...data].sort(
    (a, b) => (Number(b[dataKey]) || 0) - (Number(a[dataKey]) || 0)
  );
  const chartHeight = height ?? Math.max(250, sorted.length * 36);

  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={sorted}
            layout="vertical"
            margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey={nameKey}
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              tickLine={false}
              axisLine={false}
              width={120}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey={dataKey} radius={[0, 4, 4, 0]} maxBarSize={28}>
              {sorted.map((_, index) => (
                <Cell key={index} fill={color ?? COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
