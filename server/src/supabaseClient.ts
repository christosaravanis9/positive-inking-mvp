import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "./env.js";

let client: SupabaseClient | null = null;

/**
 * Lazily constructed, and only ever instantiated when both SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY are set -- returns null otherwise, so every
 * caller (analyticsStore.ts) has one place to branch on "is Supabase
 * actually usable right now" without duplicating the env check. Using the
 * service_role key deliberately bypasses Row Level Security: this client
 * only ever runs server-side and is never exposed to a browser.
 * persistSession/autoRefreshToken are both off -- there is no user session
 * here, only a server-to-database service connection.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
