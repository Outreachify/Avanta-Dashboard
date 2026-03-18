import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase, fetchAll } from "@/lib/supabase";
import { aggregateByPeriod } from "@/lib/utils";

interface StatsRow { campaign_id: number; date: string; emails_sent: number; bounced: number }

export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const workspaceId = searchParams.get("workspace_id");
    const campaignIdsParam = searchParams.get("campaign_ids");
    const minEmails = Number(searchParams.get("min_emails") ?? 100);
    const period = searchParams.get("period") || "day";

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "start_date and end_date are required" }, { status: 400 });
    }

    const wsIdNum = workspaceId ? Number(workspaceId) : null;
    const campaignIds = campaignIdsParam ? campaignIdsParam.split(",").map(Number).filter((n) => !isNaN(n)) : null;

    const safeStats = await fetchAll<StatsRow>(supabase, "campaign_daily_stats", "campaign_id, date, emails_sent, bounced", (q) => {
      let r = q.gte("date", startDate).lte("date", endDate);
      if (wsIdNum) r = r.eq("workspace_id", wsIdNum);
      if (campaignIds && campaignIds.length > 0) r = r.in("campaign_id", campaignIds);
      return r;
    });

    // ---------- Bounce chart ----------
    const dailyMap = new Map<
      string,
      { bounced: number; emails_sent: number }
    >();

    for (const row of safeStats) {
      const d = row.date;
      const existing = dailyMap.get(d) ?? { bounced: 0, emails_sent: 0 };
      existing.bounced += row.bounced ?? 0;
      existing.emails_sent += row.emails_sent ?? 0;
      dailyMap.set(d, existing);
    }

    const bounceChartRaw = Array.from(dailyMap.entries())
      .map(([date, vals]) => ({
        date,
        bounced: vals.bounced,
        emails_sent: vals.emails_sent,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const aggregated = aggregateByPeriod(bounceChartRaw, period, ["bounced", "emails_sent"]);
    const bounceChart = aggregated.map((row) => ({
      ...row,
      bounce_rate:
        Number(row.emails_sent) > 0
          ? Math.round((Number(row.bounced) / Number(row.emails_sent)) * 10000) / 100
          : 0,
    }));

    // ---------- Worst bounce rates per campaign ----------
    const campaignAgg = new Map<
      number,
      { bounced: number; emails_sent: number }
    >();

    for (const row of safeStats) {
      const existing = campaignAgg.get(row.campaign_id) ?? {
        bounced: 0,
        emails_sent: 0,
      };
      existing.bounced += row.bounced ?? 0;
      existing.emails_sent += row.emails_sent ?? 0;
      campaignAgg.set(row.campaign_id, existing);
    }

    // Fetch campaign names
    const campaignIdsInData = Array.from(campaignAgg.keys());
    const campaignNames = new Map<number, string>();

    if (campaignIdsInData.length > 0) {
      const campaignsData = await fetchAll<{ id: number; name: string }>(
        supabase, "campaigns", "id, name", (q) => q.in("id", campaignIdsInData)
      );
      for (const c of campaignsData) campaignNames.set(c.id, c.name);
    }

    const worstBounceRates = Array.from(campaignAgg.entries())
      .filter(([, agg]) => agg.emails_sent >= minEmails)
      .map(([campaignId, agg]) => ({
        name: campaignNames.get(campaignId) ?? `Campaign ${campaignId}`,
        bounce_rate:
          agg.emails_sent > 0
            ? Math.round((agg.bounced / agg.emails_sent) * 10000) / 100
            : 0,
        emails_sent: agg.emails_sent,
        bounced: agg.bounced,
      }))
      .sort((a, b) => b.bounce_rate - a.bounce_rate);

    return NextResponse.json({
      bounce_chart: bounceChart,
      worst_bounce_rates: worstBounceRates,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
