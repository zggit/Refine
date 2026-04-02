import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./constants";

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service-role client for server-side writes (bypasses RLS).
// NEVER import this in client components — server-only.
export const supabaseServiceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
