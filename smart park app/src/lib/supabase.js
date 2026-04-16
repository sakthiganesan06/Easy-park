import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Don't hard-crash the whole app; show a clear message in console and let UI render.
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

if (supabaseUrl && !/^https?:\/\//i.test(supabaseUrl)) {
  console.error('VITE_SUPABASE_URL must be a full URL like https://<ref>.supabase.co');
}

const isValidUrl = !!supabaseUrl && /^https?:\/\//i.test(supabaseUrl);

export const supabase = isValidUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

