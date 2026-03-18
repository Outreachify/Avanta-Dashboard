import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase, fetchAll } from "@/lib/supabase";
import { aggregateByPeriod } from "@/lib/utils";

interface CampaignStatsRow { campaign_id: number; workspace_id: number; date: string; emails_sent: number; replied: number; interested: number; bounced: number }
interface MeetingRow { date: string; workspace_id: number; count: number }

export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const workspaceId = searchParams.get("workspace_id");
    const campaignIdsParam = searchParams.get("campaign_ids");
    const period = searchParams.get("period") || "day";
    const chartStartDate = searchParams.get("chart_start_date") || startDate;

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "start_date and end_date are required" }, { status: 400 });
    }

    const wsIdNum = workspaceId ? Number(workspaceId) : null;
    const campaignIds = campaignIdsParam ? campaignIdsParam.split(",").map(Number).filter((n) => !isNaN(n)) : null;
    const fetchStart = chartStartDate && chartStartDate < startDate! ? chartStartDate : startDate!;

    // Fetch all data with pagination (use wider range for charts)
    const [allStats, allMeetings, campaignsMeta, wsRows] = await Promise.all([
      fetchAll<CampaignStatsRow>(supabase, "campaign_daily_stats", "campaign_id, workspace_id, date, emails_sent, replied, interested, bounced", (q) => {
        let r = q.gte("date", fetchStart).lte("date", endDate);
        if (wsIdNum) r = r.eq("workspace_id", wsIdNum);
        if (campaignIds && campaignIds.length > 0) r = r.in("campaign_id", campaignIds);
        return r;
      }),
      fetchAll<MeetingRow>(supabase, "meetings_booked", "date, workspace_id, count", (q) => {
        let r = q.gte("date", fetchStart).lte("date", endDate);
        if (wsIdNum) r = r.eq("workspace_id", wsIdNum);
        return r;
      }),
      fetchAll<{ id: number; name: string; workspace_id: number; created_at: string; meeting_requests: number }>(supabase, "campaigns", "id, name, workspace_id, created_at, meeting_requests", (q) => {
        let r = q;
        if (wsIdNum) r = r.eq("workspace_id", wsIdNum);
        if (campaignIds && campaignIds.length > 0) r = r.in("id", campaignIds);
        return r;
      }),
      fetchAll<{ id: number; name: string }>(supabase, "workspaces", "id, name", (q) => q),
    ]);

    const wsMap = new Map<number, string>();
    for (const ws of wsRows) wsMap.set(ws.id, ws.name);

    // Split: KPI data (narrow) vs chart data (wide)
    const safeStats = allStats.filter((r) => r.date >= startDate! && r.date <= endDate!);
    const chartStats = allStats.filter((r) => r.date >= (chartStartDate || startDate!) && r.date <= endDate!);
    const chartMeetings = allMeetings.filter((r) => r.date >= (chartStartDate || startDate!) && r.date <= endDate!);

    // ---------- Chart (wider range) ----------
    const dailyMap = new Map<string, { emails_sent: number; replied: number; positive_replies: number; meeting_requests: number }>();

    for (const row of chartStats) {
      const existing = dailyMap.get(row.date) ?? { emails_sent: 0, replied: 0, positive_replies: 0, meeting_requests: 0 };
      existing.emails_sent += row.emails_sent ?? 0;
      existing.replied += row.replied ?? 0;
      existing.positive_replies += row.interested ?? 0;
      dailyMap.set(row.date, existing);
    }

    for (const row of chartMeetings) {
      const existing = dailyMap.get(row.date) ?? { emails_sent: 0, replied: 0, positive_replies: 0, meeting_requests: 0 };
      existing.meeting_requests += row.count ?? 0;
      dailyMap.set(row.date, existing);
    }

    const rawDaily = Array.from(dailyMap.entries())
      .map(([date, vals]) => ({ date, ...vals }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const dailyChart = aggregateByPeriod(rawDaily, period, ["emails_sent", "replied", "positive_replies", "meeting_requests"]);

    // ---------- Campaigns table ----------
    // Build campaign metadata map (now includes meeting_requests from DB)
    const campaignMetaMap = new Map<number, { name: string; workspace_id: number; created_at: string; meeting_requests: number }>();
    for (const c of campaignsMeta) campaignMetaMap.set(c.id, { name: c.name, workspace_id: c.workspace_id, created_at: c.created_at, meeting_requests: c.meeting_requests ?? 0 });

    // Aggregate email stats per campaign from daily stats
    const campaignAgg = new Map<number, { emails_sent: number; replies: number; positive_replies: number; workspace_id: number }>();
    for (const row of safeStats) {
      const existing = campaignAgg.get(row.campaign_id) ?? { emails_sent: 0, replies: 0, positive_replies: 0, workspace_id: row.workspace_id };
      existing.emails_sent += row.emails_sent ?? 0;
      existing.replies += row.replied ?? 0;
      existing.positive_replies += row.interested ?? 0;
      campaignAgg.set(row.campaign_id, existing);
    }

    // Build campaigns table using real meeting_requests from campaigns table
    const campaignsTable = Array.from(campaignAgg.entries()).map(([campaignId, agg]) => {
      const meta = campaignMetaMap.get(campaignId);
      const meetingRequests = meta?.meeting_requests ?? 0;
      const emailsPerMeeting = meetingRequests > 0 ? Math.round((agg.emails_sent / meetingRequests) * 100) / 100 : 0;
      const conversionRate = agg.emails_sent > 0 ? Math.round((meetingRequests / agg.emails_sent) * 10000) / 100 : 0;

      return {
        id: campaignId,
        name: meta?.name ?? `Campaign ${campaignId}`,
        workspace_name: wsMap.get(agg.workspace_id) ?? `Workspace ${agg.workspace_id}`,
        created_at: meta?.created_at ?? null,
        emails_sent: agg.emails_sent,
        replies: agg.replies,
        positive_replies: agg.positive_replies,
        meeting_requests: meetingRequests,
        emails_per_meeting: emailsPerMeeting,
        conversion_rate: conversionRate,
      };
    }).sort((a, b) => b.emails_sent - a.emails_sent);

    return NextResponse.json({ daily_chart: dailyChart, campaigns_table: campaignsTable });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
