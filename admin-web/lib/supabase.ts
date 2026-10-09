import { createClient } from "@supabase/supabase-js";

// The publishable key is safe in the browser. Who can write is decided by
// the database (RLS + public.is_editor()), not by this page.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://pekhdowphptxjitdljgx.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_XPY3CmVQ7LknektLARnPKw_2Xm2i_lD";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const ALLOWED_DOMAIN = "princeton.edu";

export function isAllowedDomain(email: string | undefined | null) {
  return !!email && email.trim().toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}
