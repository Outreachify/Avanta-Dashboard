import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST() {
  const supabase = getServiceSupabase();

  // Create tables using raw SQL via Supabase's rpc or direct SQL
  const queries = [
    `CREATE TABLE IF NOT EXISTS workspaces (
      id BIGINT PRIMARY KEY,
      name TEXT NOT NULL,
      google_sheet_url TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS campaigns (
      id BIGINT PRIMARY KEY,
      workspace_id BIGINT NOT NULL REFERENCES workspaces(id),
      name TEXT NOT NULL,
      status TEXT,
      created_at TIMESTAMPTZ,
      synced_at TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_campaigns_workspace ON campaigns(workspace_id)`,
    `CREATE TABLE IF NOT EXISTS campaign_daily_stats (
      id BIGSERIAL PRIMARY KEY,
      campaign_id BIGINT NOT NULL REFERENCES campaigns(id),
      workspace_id BIGINT NOT NULL REFERENCES workspaces(id),
      date DATE NOT NULL,
      emails_sent INTEGER DEFAULT 0,
      replied INTEGER DEFAULT 0,
      total_opens INTEGER DEFAULT 0,
      unique_opens INTEGER DEFAULT 0,
      bounced INTEGER DEFAULT 0,
      unsubscribed INTEGER DEFAULT 0,
      interested INTEGER DEFAULT 0,
      synced_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(campaign_id, date)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON campaign_daily_stats(workspace_id, date)`,
    `CREATE TABLE IF NOT EXISTS workspace_daily_stats (
      id BIGSERIAL PRIMARY KEY,
      workspace_id BIGINT NOT NULL REFERENCES workspaces(id),
      date DATE NOT NULL,
      emails_sent INTEGER DEFAULT 0,
      replied INTEGER DEFAULT 0,
      total_opens INTEGER DEFAULT 0,
      unique_opens INTEGER DEFAULT 0,
      bounced INTEGER DEFAULT 0,
      unsubscribed INTEGER DEFAULT 0,
      interested INTEGER DEFAULT 0,
      synced_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(workspace_id, date)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ws_daily_stats_date ON workspace_daily_stats(workspace_id, date)`,
    `CREATE TABLE IF NOT EXISTS meetings_booked (
      id BIGSERIAL PRIMARY KEY,
      workspace_id BIGINT NOT NULL REFERENCES workspaces(id),
      date DATE NOT NULL,
      count INTEGER DEFAULT 0,
      synced_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(workspace_id, date)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings_booked(workspace_id, date)`,
    `CREATE TABLE IF NOT EXISTS sync_log (
      id BIGSERIAL PRIMARY KEY,
      sync_type TEXT NOT NULL,
      status TEXT NOT NULL,
      records_synced INTEGER DEFAULT 0,
      error_message TEXT,
      started_at TIMESTAMPTZ DEFAULT now(),
      completed_at TIMESTAMPTZ
    )`,
  ];

  const results = [];
  for (const query of queries) {
    const { error } = await supabase.rpc("exec_sql", { sql: query }).single();
    if (error) {
      // Try alternate approach - direct from SQL editor
      results.push({ query: query.substring(0, 50), error: error.message });
    } else {
      results.push({ query: query.substring(0, 50), status: "ok" });
    }
  }

  return NextResponse.json({
    message: "Setup attempted. If errors occurred, run the SQL directly in Supabase SQL Editor.",
    results,
    sql: queries.join(";\n\n"),
  });
}
