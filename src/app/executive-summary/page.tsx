"use client";

import { Suspense } from "react";
import useSWR from "swr";
import { useDashboardFilters } from "@/hooks/use-dashboard-filters";
import { KpiGrid } from "@/components/kpi-grid";
import { WoWComparison } from "@/components/wow-comparison";
import { DailyStatsChart } from "@/components/charts/daily-stats-chart";
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";
import { CumulativeChart } from "@/components/charts/cumulative-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function ExecutiveSummaryContent() {
  const { startDate, endDate, workspaceId, period } = useDashboardFilters();

  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    period,
  });
  if (workspaceId) params.set("workspace_id", workspaceId);

  const { data, isLoading } = useSWR(`/api/stats/executive?${params.toString()}`, fetcher);

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

  const kpis = data.kpis ?? {
    emails_sent: 0,
    replies: 0,
    positive_replies: 0,
    meeting_requests: 0,
    emails_per_meeting: 0,
    conversion_rate: 0,
  };

  const wow = data.wow ?? null;
  const dailyStats = data.daily_chart ?? [];
  const meetingsPerClient = data.meetings_per_client ?? [];
  const emailsPerMeetingPerClient = data.emails_per_meeting_per_client ?? [];
  const cumulativeStats = data.cumulative_daily ?? [];

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <KpiGrid kpis={kpis} />

      {/* WoW Comparison */}
      {wow && wow.current_week && wow.previous_week && (
        <Card>
          <CardHeader>
            <CardTitle>Week-over-Week Comparison</CardTitle>
            <CardDescription>
              Last Full Week WoW - not sensitive to date filter
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WoWComparison
              current_week={wow.current_week}
              previous_week={wow.previous_week}
            />
          </CardContent>
        </Card>
      )}

      {/* Daily Stats Chart */}
      {dailyStats.length > 0 && (
        <DailyStatsChart
          title="Daily Activity"
          data={dailyStats}
          bars={[
            { dataKey: "emails_sent", label: "Emails Sent", color: "#6366f1" },
            { dataKey: "replies", label: "Replies", color: "#22c55e" },
          ]}
          lines={[
            { dataKey: "positive_replies", label: "Positive Replies", color: "#f59e0b" },
            { dataKey: "meeting_requests", label: "Meeting Requests", color: "#ef4444" },
          ]}
        />
      )}

      {/* Horizontal Bar Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {meetingsPerClient.length > 0 && (
          <HorizontalBarChart
            title="Meetings per Client"
            data={meetingsPerClient}
            dataKey="meetings"
            nameKey="name"
          />
        )}
        {emailsPerMeetingPerClient.length > 0 && (
          <HorizontalBarChart
            title="Emails per Meeting per Client"
            data={emailsPerMeetingPerClient}
            dataKey="emails_per_meeting"
            nameKey="name"
            color="#8b5cf6"
          />
        )}
      </div>

      {/* Cumulative Chart */}
      {cumulativeStats.length > 0 && (
        <CumulativeChart
          title="Cumulative Metrics"
          data={cumulativeStats}
          metrics={[
            { dataKey: "emails_sent", label: "Emails Sent", color: "#6366f1" },
            { dataKey: "replies", label: "Replies", color: "#22c55e" },
            { dataKey: "positive_replies", label: "Positive Replies", color: "#f59e0b" },
            { dataKey: "meeting_requests", label: "Meeting Requests", color: "#ef4444" },
          ]}
        />
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

export default function ExecutiveSummaryPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ExecutiveSummaryContent />
    </Suspense>
  );
}
