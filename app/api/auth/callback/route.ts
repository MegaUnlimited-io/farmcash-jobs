import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles Supabase email confirmation and magic link redirects.
// Configure Supabase Auth → URL Configuration → Redirect URLs to include:
//   https://farmcash-jobs.vercel.app/api/auth/callback
//   http://localhost:3000/api/auth/callback
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/jobs";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Code missing or exchange failed — send back to login with error hint.
  return NextResponse.redirect(`${origin}/jobs/login?error=auth_callback_failed`);
}
