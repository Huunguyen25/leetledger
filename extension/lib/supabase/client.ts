import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const URL = import.meta.env.WXT_SUPABASE_URL;
const PUB_KEY = import.meta.env.WXT_SUPABASE_PUBLISHABLE_KEY;
export function createClient() {
  return createSupabaseClient(
    URL, PUB_KEY
  );
}