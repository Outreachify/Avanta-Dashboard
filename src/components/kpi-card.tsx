"use client";

import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber, formatPercentage } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: number;
  format?: "number" | "percentage" | "ratio";
  change?: number;
}

export function KpiCard({ title, value, format = "number", change }: KpiCardProps) {
  const formattedValue =
    format === "percentage"
      ? formatPercentage(value)
      : format === "ratio"
        ? value.toFixed(1)
        : formatNumber(value);

  return (
    <Card>
      <CardContent className="pt-1">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <div className="mt-1 flex items-end gap-2">
          <p className="text-2xl font-semibold tracking-tight text-foreground">{formattedValue}</p>
          {change !== undefined && change !== null && (
            <span
              className={`mb-0.5 inline-flex items-center gap-0.5 text-xs font-medium ${
                change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
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
}
