import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { extensionStorage } from './extension-storage'

const URL = import.meta.env.WXT_SUPABASE_URL;
const PUB_KEY = import.meta.env.WXT_SUPABASE_PUBLISHABLE_KEY;
export function createClient() {
  if (!URL || !PUB_KEY) {
    throw new Error(
      "Missing Supabase config. Set WXT_SUPABASE_URL and " +
        "WXT_SUPABASE_PUBLISHABLE_KEY in the extension's .env file.",
    );
  }
  return createSupabaseClient(URL, PUB_KEY, {
    auth: {
      // Share the session across popup / background / content scripts.
      storage: extensionStorage,
      persistSession: true,
      autoRefreshToken: true,
      // Extensions never receive the session in a URL hash.
      detectSessionInUrl: false,
    },
  });
}