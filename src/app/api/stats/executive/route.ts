import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase, fetchAll } from "@/lib/supabase";
import { getLastFullWeek, getPreviousWeek, aggregateByPeriod } from "@/lib/utils";

interface StatsRow { date: string; workspace_id: number; emails_sent: number; replied: number; interested: number; bounced: number }
interface MeetingRow { date: string; workspace_id: number; count: number }

export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const workspaceId = searchParams.get("workspace_id");
    const period = searchParams.get("period") || "day";
    // Chart uses a wider date range for trend analysis
    const chartStartDate = searchParams.get("chart_start_date") || startDate;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "start_date and end_date are required" },
        { status: 400 }
      );
    }

    // Fetch data using the WIDER chart range (covers both KPI and chart needs)
    // KPIs will filter to startDate-endDate, charts use chartStartDate-endDate
    const wsIdNum = workspaceId ? Number(workspaceId) : null;
    const fetchStart = chartStartDate && chartStartDate < startDate! ? chartStartDate : startDate!;

    const [allStats, allMeetings, wsRows] = await Promise.all([
      fetchAll<StatsRow>(supabase, "workspace_daily_stats", "date, workspace_id, emails_sent, replied, interested, bounced", (q) => {
        let r = q.gte("date", fetchStart).lte("date", endDate);
        if (wsIdNum) r = r.eq("workspace_id", wsIdNum);
        return r;
      }),
      fetchAll<MeetingRow>(supabase, "meetings_booked", "date, workspace_id, count", (q) => {
        let r = q.gte("date", fetchStart).lte("date", endDate);
        if (wsIdNum) r = r.eq("workspace_id", wsIdNum);
        return r;
      }),
      fetchAll<{ id: number; name: string }>(supabase, "workspaces", "id, name", (q) => q),
    ]);

    // Split into KPI data (narrow range) and chart data (wide range)
    const safeStats = allStats.filter((r) => r.date >= startDate! && r.date <= endDate!);
    const safeMeetings = allMeetings.filter((r) => r.date >= startDate! && r.date <= endDate!);
    const chartStats = allStats.filter((r) => r.date >= (chartStartDate || startDate!) && r.date <= endDate!);
    const chartMeetings = allMeetings.filter((r) => r.date >= (chartStartDate || startDate!) && r.date <= endDate!);

    // Build workspace name map
    const wsMap = new Map<number, string>();
    for (const ws of wsRows) {
      wsMap.set(ws.id, ws.name);
    }

    // ---------- KPIs ----------
    const emailsSent = safeStats.reduce((s, r) => s + (r.emails_sent ?? 0), 0);
    const replies = safeStats.reduce((s, r) => s + (r.replied ?? 0), 0);
    const positiveReplies = safeStats.reduce((s, r) => s + (r.interested ?? 0), 0);
    const meetingRequests = safeMeetings.reduce((s, r) => s + (r.count ?? 0), 0);
    const emailsPerMeeting = meetingRequests > 0 ? Math.round((emailsSent / meetingRequests) * 100) / 100 : 0;
    const conversionRate = emailsSent > 0 ? Math.round((meetingRequests / emailsSent) * 10000) / 100 : 0;

    const kpis = {
      emails_sent: emailsSent,
      replies,
      positive_replies: positiveReplies,
      meeting_requests: meetingRequests,
      emails_per_meeting: emailsPerMeeting,
      conversion_rate: conversionRate,
    };

    // ---------- WoW ----------
    const lastWeek = getLastFullWeek();
    const prevWeek = getPreviousWeek(lastWeek.start);

    async function getWeekKpis(wStart: string, wEnd: string) {
      const [ws, wm] = await Promise.all([
        fetchAll<{ emails_sent: number; replied: number; interested: number }>(
          supabase, "workspace_daily_stats", "emails_sent, replied, interested", (q) => {
            let r = q.gte("date", wStart).lte("date", wEnd);
            if (wsIdNum) r = r.eq("workspace_id", wsIdNum);
            return r;
          }
        ),
        fetchAll<{ count: number }>(
          supabase, "meetings_booked", "count", (q) => {
            let r = q.gte("date", wStart).lte("date", wEnd);
            if (wsIdNum) r = r.eq("workspace_id", wsIdNum);
            return r;
          }
        ),
      ]);
      const es = ws.reduce((s, r) => s + (r.emails_sent ?? 0), 0);
      const rp = ws.reduce((s, r) => s + (r.replied ?? 0), 0);
      const pr = ws.reduce((s, r) => s + (r.interested ?? 0), 0);
      const mr = wm.reduce((s, r) => s + (r.count ?? 0), 0);
      return {
        emails_sent: es,
        replies: rp,
        positive_replies: pr,
        meeting_requests: mr,
        emails_per_meeting: mr > 0 ? Math.round((es / mr) * 100) / 100 : 0,
        conversion_rate: es > 0 ? Math.round((mr / es) * 10000) / 100 : 0,
      };
    }

    const [currentWeekKpis, previousWeekKpis] = await Promise.all([
      getWeekKpis(lastWeek.start, lastWeek.end),
      getWeekKpis(prevWeek.start, prevWeek.end),
    ]);

    function pctChange(curr: number, prev: number): number {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 10000) / 100;
    }

    const wow = {
      current_week: currentWeekKpis,
      previous_week: previousWeekKpis,
      change_percentage: {
        emails_sent: pctChange(currentWeekKpis.emails_sent, previousWeekKpis.emails_sent),
        replies: pctChange(currentWeekKpis.replies, previousWeekKpis.replies),
        positive_replies: pctChange(currentWeekKpis.positive_replies, previousWeekKpis.positive_replies),
        meeting_requests: pctChange(currentWeekKpis.meeting_requests, previousWeekKpis.meeting_requests),
        emails_per_meeting: pctChange(currentWeekKpis.emails_per_meeting, previousWeekKpis.emails_per_meeting),
        conversion_rate: pctChange(currentWeekKpis.conversion_rate, previousWeekKpis.conversion_rate),
      },
    };

    // ---------- Chart data (uses wider range for trend analysis) ----------
    const dailyMap = new Map<string, { emails_sent: number; replies: number; positive_replies: number; meeting_requests: number }>();

    for (const row of chartStats) {
      const existing = dailyMap.get(row.date) ?? { emails_sent: 0, replies: 0, positive_replies: 0, meeting_requests: 0 };
      existing.emails_sent += row.emails_sent ?? 0;
      existing.replies += row.replied ?? 0;
      existing.positive_replies += row.interested ?? 0;
      dailyMap.set(row.date, existing);
    }

    for (const row of chartMeetings) {
      const existing = dailyMap.get(row.date) ?? { emails_sent: 0, replies: 0, positive_replies: 0, meeting_requests: 0 };
      existing.meeting_requests += row.count ?? 0;
      dailyMap.set(row.date, existing);
    }

    const rawDaily = Array.from(dailyMap.entries())
      .map(([date, vals]) => ({ date, ...vals }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Aggregate chart data by period (KPIs use raw totals above)
    const chartKeys = ["emails_sent", "replies", "positive_replies", "meeting_requests"];
    const dailyChart = aggregateByPeriod(rawDaily, period, chartKeys);

    // ---------- Cumulative ----------
    let cumEmails = 0, cumReplies = 0, cumPositive = 0, cumMeetings = 0;
    const cumulativeDaily = dailyChart.map((row) => {
      cumEmails += Number(row.emails_sent) || 0;
      cumReplies += Number(row.replies) || 0;
      cumPositive += Number(row.positive_replies) || 0;
      cumMeetings += Number(row.meeting_requests) || 0;
      return {
        date: row.date,
        emails_sent: cumEmails,
        replies: cumReplies,
        positive_replies: cumPositive,
        meeting_requests: cumMeetings,
      };
    });

    // ---------- Meetings per client ----------
    const meetingsPerWs = new Map<number, number>();
    for (const row of safeMeetings) {
      meetingsPerWs.set(row.workspace_id, (meetingsPerWs.get(row.workspace_id) ?? 0) + (row.count ?? 0));
    }
    const meetingsPerClient = Array.from(meetingsPerWs.entries())
      .map(([wsId, meetings]) => ({ name: wsMap.get(wsId) ?? `Workspace ${wsId}`, meetings }))
      .sort((a, b) => b.meetings - a.meetings);

    // ---------- Emails per meeting per client ----------
    const emailsPerWs = new Map<number, number>();
    for (const row of safeStats) {
      emailsPerWs.set(row.workspace_id, (emailsPerWs.get(row.workspace_id) ?? 0) + (row.emails_sent ?? 0));
    }
    const emailsPerMeetingPerClient = Array.from(new Set([...meetingsPerWs.keys(), ...emailsPerWs.keys()]))
      .map((wsId) => {
        const es = emailsPerWs.get(wsId) ?? 0;
        const mt = meetingsPerWs.get(wsId) ?? 0;
        return {
          name: wsMap.get(wsId) ?? `Workspace ${wsId}`,
          emails_per_meeting: mt > 0 ? Math.round((es / mt) * 100) / 100 : 0,
        };
      })
      .filter((r) => r.emails_per_meeting > 0)
      .sort((a, b) => a.emails_per_meeting - b.emails_per_meeting);

    // Workspaces list for client filter dropdown
    const workspacesList = Array.from(wsMap.entries())
      .map(([id, name]) => ({ workspace_id: String(id), workspace_name: name }))
      .sort((a, b) => a.workspace_name.localeCompare(b.workspace_name));

    return NextResponse.json({
      kpis,
      wow,
      daily_chart: dailyChart,
      meetings_per_client: meetingsPerClient,
      emails_per_meeting_per_client: emailsPerMeetingPerClient,
      cumulative_daily: cumulativeDaily,
      workspaces: workspacesList,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
