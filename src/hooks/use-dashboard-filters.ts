"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import { format, subDays } from "date-fns";

export function useDashboardFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const todayStr = format(new Date(), "yyyy-MM-dd");

  // Default: Week view (last 7 days)
  const startDate = searchParams.get("start_date") ?? format(subDays(new Date(), 6), "yyyy-MM-dd");
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
        newStart = todayFmt; // today only
      } else if (p === "week") {
        newStart = format(subDays(today, 6), "yyyy-MM-dd"); // last 7 days
      } else {
        newStart = format(subDays(today, 29), "yyyy-MM-dd"); // last 30 days
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
