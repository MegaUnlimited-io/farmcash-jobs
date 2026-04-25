"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  if (!user) {
    return (
      <a
        href="https://farmcash.app/login/?login=true&next=https://farmcash.app/verify/?next=https://farmcash.app/jobs"
        className="text-xs font-medium text-muted hover:text-fg transition-colors bg-border/50 px-3 py-1.5 rounded-full"
      >
        Sign In
      </a>
    );
  }

  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        router.push("/jobs");
        router.refresh();
      }}
      className="text-xs font-medium text-muted hover:text-fg transition-colors bg-border/50 px-3 py-1.5 rounded-full"
    >
      Sign Out
    </button>
  );
}
