import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy-initialized clients (env vars not available during static build)
let _supabase: SupabaseClient | null = null;
let _serviceSupabase: SupabaseClient | null = null;

// Client-side Supabase client (uses anon key)
export function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _supabase;
}

// For backward compat — lazy getter
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// Server-side Supabase client (uses service role key for admin ops)
export function getServiceSupabase() {
  if (!_serviceSupabase) {
    _serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _serviceSupabase;
}

// Paginated fetch — Supabase limits to 1000 rows per request
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
