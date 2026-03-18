import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side Supabase client (uses anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side Supabase client (uses service role key for admin ops)
export function getServiceSupabase() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceRoleKey);
}

// Paginated fetch — Supabase limits to 1000 rows per request
// This fetches ALL matching rows by paginating in chunks of 1000
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAll<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  filters: (query: any) => any,
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const allRows: T[] = [];
  let from = 0;

  while (true) {
    const baseQuery = supabase
      .from(table)
      .select(select)
      .range(from, from + PAGE_SIZE - 1);

    const query = filters(baseQuery);

    const { data, error } = await query;
    if (error) throw new Error(`fetchAll(${table}): ${error.message}`);
    if (!data || data.length === 0) break;

    allRows.push(...(data as T[]));

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allRows;
}
