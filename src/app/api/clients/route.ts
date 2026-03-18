import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

function maskToken(token: string | null): string {
  if (!token) return "Not generated";
  if (token.length <= 9) return "***";
  return token.slice(0, 5) + "..." + token.slice(-4);
}

export async function GET() {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("workspaces")
      .select("*")
      .order("name")
      .range(0, 999);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const clients = (data ?? []).map((ws) => ({
      id: ws.id,
      name: ws.name,
      client_status: ws.client_status ?? "active",
      api_token_masked: maskToken(ws.api_token),
      has_api_token: !!ws.api_token,
      google_sheet_url: ws.google_sheet_url ?? null,
      is_active: ws.is_active ?? true,
    }));

    return NextResponse.json({ clients });
  } catch (err) {
    console.error("GET /api/clients error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, api_token, google_sheet_url } = body;

    if (!name || !api_token) {
      return NextResponse.json(
        { error: "name and api_token are required" },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // Find next available ID
    const { data: maxRow } = await supabase
      .from("workspaces")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .single();

    const newId = (maxRow?.id ?? 0) + 1;

    const { error } = await supabase.from("workspaces").insert({
      id: newId,
      name: name.trim(),
      api_token: api_token.trim(),
      google_sheet_url: google_sheet_url || null,
      is_active: true,
      client_status: "active",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: newId, name });
  } catch (err) {
    console.error("POST /api/clients error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace_id, client_status } = body;

    if (!workspace_id || !["active", "churned"].includes(client_status)) {
      return NextResponse.json(
        { error: "Invalid workspace_id or client_status. Must be 'active' or 'churned'." },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from("workspaces")
      .update({ client_status })
      .eq("id", workspace_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, workspace_id, client_status });
  } catch (err) {
    console.error("PATCH /api/clients error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
