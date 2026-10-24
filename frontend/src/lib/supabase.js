import { createClient } from '@supabase/supabase-js';

/**
 * Browser-side Supabase client, used for authentication only.
 *
 * Notes and todos still go through the Express API, which receives the
 * session's access token. The anon key is public by design; RLS protects data.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
