"use client";

import { KpiCard } from "@/components/kpi-card";

interface KpiData {
  emails_sent: number;
  replies: number;
  positive_replies: number;
  meeting_requests: number;
  emails_per_meeting: number;
  conversion_rate: number;
}

interface KpiGridProps {
  kpis: KpiData;
}

export function KpiGrid({ kpis }: KpiGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
      <KpiCard title="Emails Sent" value={kpis.emails_sent} format="number" />
      <KpiCard title="Replies" value={kpis.replies} format="number" />
      <KpiCard title="Positive Replies" value={kpis.positive_replies} format="number" />
      <KpiCard title="Meeting Requests" value={kpis.meeting_requests} format="number" />
      <KpiCard title="Emails / Meeting" value={kpis.emails_per_meeting} format="ratio" />
      <KpiCard title="Conversion Rate" value={kpis.conversion_rate} format="percentage" />
    </div>
  );
}
