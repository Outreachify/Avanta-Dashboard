"use client";

import { Suspense, useState, useMemo, useRef, useEffect } from "react";
import useSWR from "swr";
import { useDashboardFilters } from "@/hooks/use-dashboard-filters";
import { DailyStatsChart } from "@/components/charts/daily-stats-chart";
import { CampaignTable } from "@/components/campaign-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, X, Search } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function CampaignsContent() {
  const { startDate, endDate, chartStartDate, workspaceId, period } = useDashboardFilters();
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);

  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    chart_start_date: chartStartDate,
    period,
  });
  if (workspaceId) params.set("workspace_id", workspaceId);

  const { data, isLoading } = useSWR(`/api/stats/campaigns?${params.toString()}`, fetcher);

  const campaignNames: string[] = useMemo(() => {
    if (!data?.campaigns_table) return [];
    return [...new Set(data.campaigns_table.map((c: { name: string }) => c.name))] as string[];
  }, [data]);

  const filteredCampaigns = useMemo(() => {
    if (!data?.campaigns_table) return [];
    if (selectedCampaigns.length === 0) return data.campaigns_table;
    return data.campaigns_table.filter((c: { name: string }) =>
      selectedCampaigns.includes(c.name)
    );
  }, [data, selectedCampaigns]);

  const dailyStats = useMemo(() => {
    if (!data?.daily_chart) return [];
    return data.daily_chart;
  }, [data]);

  const toggleCampaign = (name: string) => {
    setSelectedCampaigns((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        No data available. Try syncing data first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Campaign Filter */}
      {campaignNames.length > 0 && (
        <CampaignMultiSelect
          options={campaignNames}
          selected={selectedCampaigns}
          onToggle={toggleCampaign}
          onClear={() => setSelectedCampaigns([])}
        />
      )}

      {/* Daily Stats Chart */}
      {dailyStats.length > 0 && (
        <DailyStatsChart
          title="Campaign Daily Activity"
          data={dailyStats}
          bars={[
            { dataKey: "emails_sent", label: "Emails Sent", color: "#6366f1" },
            { dataKey: "replies", label: "Replies", color: "#22c55e" },
          ]}
          lines={[
            { dataKey: "positive_replies", label: "Positive Replies", color: "#f59e0b" },
          ]}
        />
      )}

      {/* Campaign Table */}
      <CampaignTable title="Campaign Performance" data={filteredCampaigns} />
    </div>
  );
}

function CampaignMultiSelect({
  options,
  selected,
  onToggle,
  onClear,
}: {
  options: string[];
  selected: string[];
  onToggle: (name: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = search
    ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <div className="flex items-center gap-3">
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm text-foreground hover:bg-muted transition-colors min-w-[220px] justify-between"
        >
          <span className="truncate">
            {selected.length === 0
              ? "All Campaigns"
              : `${selected.length} campaign${selected.length > 1 ? "s" : ""} selected`}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>

        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-lg border border-border bg-card shadow-xl">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search campaigns..."
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {filtered.map((name) => {
                const isSelected = selected.includes(name);
                return (
                  <button
                    key={name}
                    onClick={() => onToggle(name)}
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-500 text-white"
                          : "border-border"
                      }`}
                    >
                      {isSelected && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span className="truncate text-left">{name}</span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">No campaigns found</p>
              )}
            </div>
            {selected.length > 0 && (
              <div className="border-t border-border px-3 py-2">
                <button
                  onClick={() => { onClear(); setOpen(false); }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected badges */}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {selected.map((name) => (
            <Badge
              key={name}
              className="gap-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25 cursor-pointer hover:bg-indigo-500/20"
              onClick={() => onToggle(name)}
            >
              {name.length > 30 ? name.slice(0, 30) + "..." : name}
              <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

export default function CampaignsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <CampaignsContent />
    </Suspense>
  );
}
