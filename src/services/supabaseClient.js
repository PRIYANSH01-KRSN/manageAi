// Browser Supabase client (auth only — data goes through our API so the server can
// validate it). Disabled automatically when the env vars aren't set (local dev).
import { createClient } from '@supabase/supabase-js';

// Accept the project URL even if it was pasted with a path like /rest/v1/.
export function normalizeSupabaseUrl(raw) {
  return String(raw || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/(rest|auth)\/v1$/i, '')
    .replace(/\/+$/, '');
}

export const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
export const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
    : null;
export const authEnabled = Boolean(supabase);

export async function getAccessToken() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}
