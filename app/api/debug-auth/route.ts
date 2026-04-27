import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// TEMPORARY — delete after admin access is confirmed working.
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  let adminRow = null;
  let adminError = null;

  if (user) {
    const service = createServiceClient();
    const { data, error } = await service
      .from("admins")
      .select("user_id")
      .eq("user_id", user.id)
      .single();
    adminRow = data;
    adminError = error?.message ?? null;
  }

  return NextResponse.json({
    user: user ? { id: user.id, email: user.email } : null,
    userError: userError?.message ?? null,
    adminRow,
    adminError,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
