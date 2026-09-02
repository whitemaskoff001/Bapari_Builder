import { createClient } from '@supabase/supabase-js';

// Use the real project as a safe fallback so the app keeps connecting to the
// correct Supabase project even when repo env variables are missing or stale.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://oddbplwvymcogcqbfpgj.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_NdceNs3vXyij55UT8Ns4hg_H6PnXCQw';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
