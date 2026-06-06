import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://pekhdowphptxjitdljgx.supabase.co";
const supabaseAnonKey = "sb_publishable_XPY3CmVQ7LknektLARnPKw_2Xm2i_lD";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);