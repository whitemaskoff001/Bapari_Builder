import { createClient } from '@supabase/supabase-js';

// Use the real project as a safe fallback so the app keeps connecting to the
// correct Supabase project even when repo env variables are missing or stale.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://oddbplwvymcogcqbfpgj.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_NdceNs3vXyij55UT8Ns4hg_H6PnXCQw';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Persist the Supabase auth session in localStorage and auto-refresh the
// access token so refreshing the page does not log the user out.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'bapari-auth',
  },
});
