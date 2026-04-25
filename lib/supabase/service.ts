import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

// Service role client — bypasses all RLS. Server-side use only.
// SUPABASE_SERVICE_ROLE_KEY must never appear in client-side code.
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
