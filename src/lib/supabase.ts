import { createClient } from '@supabase/supabase-js';

// Keep the public storefront renderable when the optional backend secrets are
// not configured in a preview or static deployment.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
