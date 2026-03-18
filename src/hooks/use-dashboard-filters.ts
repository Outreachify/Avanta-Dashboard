"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import { format, subDays, subWeeks, subMonths } from "date-fns";

export function useDashboardFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const todayStr = format(new Date(), "yyyy-MM-dd");

  // Default: Week view (last 5 weeks)
  const startDate = searchParams.get("start_date") ?? format(subWeeks(new Date(), 4), "yyyy-MM-dd");
  const endDate = searchParams.get("end_date") ?? todayStr;
  const workspaceId = searchParams.get("workspace_id") ?? "";
  const period = (searchParams.get("period") ?? "week") as "day" | "week" | "month";

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname]
  );

  const setDateRange = useCallback(
    (start: string, end: string) => {
      updateParams({ start_date: start, end_date: end });
    },
    [updateParams]
  );

  const setWorkspaceId = useCallback(
    (id: string) => {
      updateParams({ workspace_id: id });
    },
    [updateParams]
  );

  const setPeriod = useCallback(
    (p: "day" | "week" | "month") => {
      const today = new Date();
      const todayFmt = format(today, "yyyy-MM-dd");
      let newStart: string;
      if (p === "day") {
        // Last 7 days, chart = daily points
        newStart = format(subDays(today, 6), "yyyy-MM-dd");
      } else if (p === "week") {
        // Last 5 weeks, chart = weekly points
        newStart = format(subWeeks(today, 4), "yyyy-MM-dd");
      } else {
        // Last 6 months, chart = monthly points
        newStart = format(subMonths(today, 5), "yyyy-MM-dd");
      }
      updateParams({ period: p, start_date: newStart, end_date: todayFmt });
    },
    [updateParams]
  );

  return {
    startDate,
    endDate,
    workspaceId,
    period,
    setDateRange,
    setWorkspaceId,
    setPeriod,
  };
}
