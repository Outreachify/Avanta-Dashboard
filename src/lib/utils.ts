import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { startOfWeek, endOfWeek, subWeeks, format, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + "M";
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + "k";
  }
  return value.toLocaleString();
}

export function formatPercentage(value: number): string {
  if (value < 0.01 && value > 0) return "<0.01%";
  return value.toFixed(2) + "%";
}

export function getLastFullWeek(): { start: string; end: string } {
  const today = new Date();
  const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
  return {
    start: format(lastWeekStart, "yyyy-MM-dd"),
    end: format(lastWeekEnd, "yyyy-MM-dd"),
  };
}

export function getPreviousWeek(lastWeekStart: string): { start: string; end: string } {
  const d = new Date(lastWeekStart);
  const prevStart = startOfWeek(subWeeks(d, 1), { weekStartsOn: 1 });
  const prevEnd = endOfWeek(subWeeks(d, 1), { weekStartsOn: 1 });
  return {
    start: format(prevStart, "yyyy-MM-dd"),
    end: format(prevEnd, "yyyy-MM-dd"),
  };
}

export function getDefaultDateRange(): { start: string; end: string } {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6);
  return {
    start: format(weekAgo, "yyyy-MM-dd"),
    end: format(today, "yyyy-MM-dd"),
  };
}

export function aggregateByPeriod(
  dailyData: Record<string, unknown>[],
  period: string,
  sumKeys: string[],
): Record<string, unknown>[] {
  if (period === "day" || !period) return dailyData;

  const buckets = new Map<string, Record<string, number>>();

  for (const row of dailyData) {
    const date = parseISO(row.date as string);
    let bucketKey: string;

    if (period === "week") {
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      bucketKey = format(weekStart, "yyyy-MM-dd");
    } else {
      // month
      bucketKey = format(date, "yyyy-MM-01");
    }

    if (!buckets.has(bucketKey)) {
      const init: Record<string, number> = {};
      for (const k of sumKeys) init[k] = 0;
      buckets.set(bucketKey, init);
    }

    const bucket = buckets.get(bucketKey)!;
    for (const k of sumKeys) {
      bucket[k] += Number(row[k]) || 0;
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucketDate, vals]) => {
      const d = parseISO(bucketDate);
      let label: string;
      if (period === "week") {
        label = format(d, "'Week of' MMM d");
      } else {
        label = format(d, "MMM yyyy");
      }
      return { date: label, ...vals };
    });
}
