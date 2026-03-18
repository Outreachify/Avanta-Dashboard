"use client";

import { Suspense, useState, useMemo } from "react";
import useSWR from "swr";
import { useDashboardFilters } from "@/hooks/use-dashboard-filters";
import { BounceChart } from "@/components/charts/bounce-chart";
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function DeliverabilityContent() {
  const { startDate, endDate, workspaceId, period } = useDashboardFilters();
  const [minEmailsSent, setMinEmailsSent] = useState(10);

  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    period,
  });
  if (workspaceId) params.set("workspace_id", workspaceId);

  const { data, isLoading } = useSWR(`/api/stats/deliverability?${params.toString()}`, fetcher);

  const bounceTimeSeries = data?.bounce_chart ?? [];
  const worstBounceRates = useMemo(() => {
    if (!data?.worst_bounce_rates) return [];
    return data.worst_bounce_rates
      .filter((s: { emails_sent: number }) => s.emails_sent >= minEmailsSent)
      .sort((a: { bounce_rate: number }, b: { bounce_rate: number }) => b.bounce_rate - a.bounce_rate)
      .slice(0, 20);
  }, [data, minEmailsSent]);

  const maxEmails = useMemo(() => {
    if (!data?.worst_bounce_rates?.length) return 100;
    return Math.max(
      ...data.worst_bounce_rates.map((s: { emails_sent: number }) => s.emails_sent)
    );
  }, [data]);

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
      {/* Bounce Chart */}
      {bounceTimeSeries.length > 0 && (
        <BounceChart title="Bounce Trend" data={bounceTimeSeries} />
      )}

      {/* Min Emails Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Worst Bounce Rates by Sender</CardTitle>
          <CardDescription>
            Showing senders with at least {minEmailsSent} emails sent
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 max-w-md">
            <label className="mb-2 block text-xs font-medium text-muted-foreground">
              Min. Emails Sent: {minEmailsSent}
            </label>
            <Slider
              defaultValue={[minEmailsSent]}
              onValueCommitted={(value) => {
                const v = Array.isArray(value) ? value[0] : value;
                setMinEmailsSent(v as number);
              }}
              min={1}
              max={Math.max(maxEmails, 100)}
            />
          </div>

          {worstBounceRates.length > 0 ? (
            <HorizontalBarChart
              data={worstBounceRates}
              dataKey="bounce_rate"
              nameKey="name"
              color="#ef4444"
            />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No senders match the current filter criteria.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

export default function DeliverabilityPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <DeliverabilityContent />
    </Suspense>
  );
}
