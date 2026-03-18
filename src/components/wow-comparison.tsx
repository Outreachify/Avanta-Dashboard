"use client";

import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber, formatPercentage } from "@/lib/utils";

interface WoWKPIs {
  emails_sent: number;
  replies: number;
  positive_replies: number;
  meeting_requests: number;
  emails_per_meeting: number;
  conversion_rate: number;
}

interface WoWComparisonProps {
  current_week: WoWKPIs;
  previous_week: WoWKPIs;
}

interface MetricDef {
  key: keyof WoWKPIs;
  label: string;
  format: "number" | "percentage" | "ratio";
  higherIsBetter: boolean;
}

const metrics: MetricDef[] = [
  { key: "emails_sent", label: "Emails Sent", format: "number", higherIsBetter: true },
  { key: "replies", label: "Replies", format: "number", higherIsBetter: true },
  { key: "positive_replies", label: "Positive Replies", format: "number", higherIsBetter: true },
  { key: "meeting_requests", label: "Meeting Requests", format: "number", higherIsBetter: true },
  { key: "emails_per_meeting", label: "Emails / Meeting", format: "ratio", higherIsBetter: false },
  { key: "conversion_rate", label: "Conversion Rate", format: "percentage", higherIsBetter: true },
];

function formatValue(value: number, fmt: "number" | "percentage" | "ratio") {
  if (fmt === "percentage") return formatPercentage(value);
  if (fmt === "ratio") return value.toFixed(1);
  return formatNumber(value);
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function WoWComparison({ current_week, previous_week }: WoWComparisonProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
      {metrics.map((m) => {
        const current = current_week[m.key];
        const previous = previous_week[m.key];
        const change = pctChange(current, previous);
        const isPositive =
          change !== null && (m.higherIsBetter ? change >= 0 : change <= 0);

        return (
          <Card key={m.key}>
            <CardContent className="pt-1">
              <p className="text-xs font-medium text-muted-foreground">{m.label}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                {formatValue(current, m.format)}
              </p>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  prev: {formatValue(previous, m.format)}
                </span>
                {change !== null && (
                  <span
                    className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                      isPositive
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {change >= 0 ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {Math.abs(change).toFixed(1)}%
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
