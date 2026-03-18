import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { WORKSPACES } from "@/lib/workspace-data";

export async function POST() {
  const supabase = getServiceSupabase();

  const rows = WORKSPACES.map((ws) => ({
    id: ws.id,
    name: ws.name,
    google_sheet_url: ws.google_sheet_url,
    is_active: true,
  }));

  const { data, error } = await supabase
    .from("workspaces")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: `Seeded ${rows.length} workspaces`, data });
}
