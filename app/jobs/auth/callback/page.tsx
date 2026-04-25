"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Handles Supabase implicit-flow magic links.
// The magic link redirects here with tokens in the URL hash (#access_token=...&refresh_token=...).
// We call setSession() on the @supabase/ssr browser client, which writes the session to cookies
// instead of localStorage — making it visible to Next.js server components and API routes.
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (access_token && refresh_token) {
      supabase.auth
        .setSession({ access_token, refresh_token })
        .then(() => router.replace("/jobs"))
        .catch(() => router.replace("/jobs"));
    } else {
      // No tokens — nothing to do, send to jobs
      router.replace("/jobs");
    }
  }, [router]);

  return (
    <main className="min-h-screen bg-bg flex items-center justify-center">
      <p className="text-sm text-muted">Signing in…</p>
    </main>
  );
}
