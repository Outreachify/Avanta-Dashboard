"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, CalendarIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboardFilters } from "@/hooks/use-dashboard-filters";
import useSWR from "swr";
import type { DateRange } from "react-day-picker";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const pageTitles: Record<string, string> = {
  "/executive-summary": "Executive Summary",
  "/campaigns": "Campaigns",
  "/deliverability": "Deliverability",
  "/clients": "Clients",
};

export function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { startDate, endDate, workspaceId, period, setDateRange, setWorkspaceId, setPeriod } =
    useDashboardFilters();

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: execData } = useSWR(
    `/api/stats/executive?start_date=${startDate}&end_date=${endDate}`,
    fetcher
  );
  const workspaces: { workspace_id: string; workspace_name: string }[] =
    execData?.workspaces ?? [];

  const pageTitle = pageTitles[pathname] ?? "Dashboard";

  const dateRange: DateRange = {
    from: parseISO(startDate),
    to: parseISO(endDate),
  };

  const handleDateSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setDateRange(format(range.from, "yyyy-MM-dd"), format(range.to, "yyyy-MM-dd"));
    }
  };

  return (
    <header className="flex flex-col gap-4 border-b border-border bg-card px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-xl font-semibold text-foreground pl-10 lg:pl-0">{pageTitle}</h1>

      <div className="flex flex-wrap items-center gap-2">
        {/* Date Range Picker */}
        <Popover>
          <PopoverTrigger
            className="inline-flex h-8 items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span>
              {format(parseISO(startDate), "MMM d")} - {format(parseISO(endDate), "MMM d, yyyy")}
            </span>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-0">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={handleDateSelect}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        {/* Period Toggle */}
        <div className="inline-flex h-8 items-center rounded-lg border border-input bg-transparent p-0.5">
          {(["day", "week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                period === p
                  ? "bg-indigo-500 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Client Filter */}
        <Select value={workspaceId || "all"} onValueChange={(val) => setWorkspaceId(!val || val === "all" ? "" : val)}>
          <SelectTrigger className="h-8 min-w-[200px]">
            <SelectValue>
              {workspaceId
                ? workspaces.find((ws) => ws.workspace_id === workspaceId)?.workspace_name ?? "Client"
                : "All Clients"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-80">
            <SelectItem value="all">All Clients</SelectItem>
            {workspaces.map((ws) => (
              <SelectItem key={ws.workspace_id} value={ws.workspace_id}>
                {ws.workspace_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Theme Toggle */}
        {mounted && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </header>
  );
}
