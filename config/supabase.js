// config/supabase.js - Direct Supabase Client with live .env reload support
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

export let supabase = null;

function initSupabaseIfNeeded() {
  if (supabase) return true;

  dotenv.config();
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  const valid = !!(
    supabaseUrl &&
    supabaseKey &&
    supabaseUrl.startsWith('https://') &&
    !supabaseUrl.includes('placeholder') &&
    !supabaseUrl.includes('your-project')
  );

  if (valid) {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    console.log(`[Supabase] Connected to remote project: ${supabaseUrl}`);
    return true;
  }

  return false;
}

export const isSupabaseConfigured = () => {
  return initSupabaseIfNeeded();
};

if (!initSupabaseIfNeeded()) {
  console.log('[Supabase] Waiting for SUPABASE_URL and SUPABASE_ANON_KEY in .env');
}
