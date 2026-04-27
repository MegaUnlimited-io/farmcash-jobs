import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, getPendingComments, getAdminStats, getFeaturedList } from "@/lib/db/admin";
import { ModerationList } from "./ModerationList";
import { FeaturedManager } from "./FeaturedManager";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Admin — FarmCash Jobs" };

// cookies() is a runtime API — must be inside <Suspense> with cacheComponents.
export default function AdminPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-bg" />}>
      <AdminContent />
    </Suspense>
  );
}

async function AdminContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/jobs");

  const adminStatus = await isAdmin(user.id);
  if (!adminStatus) redirect("/jobs");

  const [pending, stats, featuredList] = await Promise.all([
    getPendingComments(),
    getAdminStats(),
    getFeaturedList(),
  ]);

  return (
    <main className="min-h-screen bg-bg text-fg">
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-fg">Admin</h1>
            <p className="text-xs text-muted">FarmCash Jobs</p>
          </div>
          <Link href="/jobs" className="text-xs text-muted hover:text-fg transition-colors">
            ← Back to Jobs
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* ── Stats bar ── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Total Jobs",     value: stats.totalJobs },
            { label: "Enriched",       value: stats.enrichedJobs },
            { label: "Unenriched",     value: stats.unenrichedJobs },
            { label: "Pending Review", value: stats.pendingComments },
            { label: "Human Ratings",  value: stats.totalRatings },
          ].map(({ label, value }) => (
            <div key={label} className="bg-card border border-border rounded-xl px-4 py-3">
              <p className="text-xl font-bold text-fg tabular-nums">{value.toLocaleString()}</p>
              <p className="text-xs text-muted mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Featured jobs ── */}
        <section className="bg-card border border-border rounded-xl p-4">
          <FeaturedManager initialList={featuredList} />
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
              Pending Comments
            </h2>
            <span className="text-xs text-muted">{pending.length} to review</span>
          </div>

          {pending.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted">
              All caught up — no pending comments.
            </div>
          ) : (
            <ModerationList comments={pending} />
          )}
        </section>
      </div>
    </main>
  );
}
