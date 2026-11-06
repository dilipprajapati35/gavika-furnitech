import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
);

export function createEphemeralClient() {
  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Returns a Supabase client for server-side operations.
 * Uses SUPABASE_SERVICE_ROLE_KEY if available to bypass RLS safely,
 * otherwise falls back to NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
 */
export function getServiceClient() {
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || supabasePublishableKey;
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}