// sync-jobs — Supabase Edge Function
// Fetches offers from all enabled partner adapters, upserts to the jobs table,
// and revalidates ISR pages for any changed offers.
//
// Cron: every 6 hours (configure in Supabase dashboard → Edge Functions → Schedules)
// Secrets required: AYET_STATIC_API_KEY, AYET_JOBS_ADSLOT_ID, REVALIDATION_SECRET, NEXT_APP_URL
// Auto-provided by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createAyetAdapter } from "./adapters/ayetstudios.ts";
import { upsertOffers } from "./db/upsert.ts";

// Register enabled adapters here. Add new partners by importing and appending.
const ADAPTERS = [
  createAyetAdapter(),
  // createRevuAdapter(), // uncomment when Revu is ready
];

Deno.serve(async (_req) => {
  const summary: Record<string, unknown> = {};

  try {
    const allUpdatedSlugs: string[] = [];
    const allRemovedSlugs: string[] = [];
    let listingNeedsRevalidation = false;

    for (const adapter of ADAPTERS) {
      console.log(`[sync-jobs] Fetching ${adapter.partner_id}...`);

      try {
        const offers = await adapter.fetchOffers();
        console.log(
          `[sync-jobs] ${adapter.partner_id}: ${offers.length} offers from API`,
        );

        const { updatedSlugs, newCount, removedSlugs } = await upsertOffers(
          offers,
          adapter.partner_id,
        );

        summary[adapter.partner_id] = {
          fetched: offers.length,
          updated: updatedSlugs.length,
          inserted: newCount,
          removed: removedSlugs.length,
        };

        allUpdatedSlugs.push(...updatedSlugs);
        allRemovedSlugs.push(...removedSlugs);

        // New inserts or removals always mean the listing changed
        if (newCount > 0 || removedSlugs.length > 0) {
          listingNeedsRevalidation = true;
        }
      } catch (adapterErr) {
        console.error(
          `[sync-jobs] ${adapter.partner_id} failed:`,
          adapterErr,
        );
        summary[adapter.partner_id] = { error: String(adapterErr) };
      }
    }

    // Revalidate changed pages
    await revalidate({
      slugs: [...new Set([...allUpdatedSlugs, ...allRemovedSlugs])],
      revalidateListing: listingNeedsRevalidation,
    });

    console.log("[sync-jobs] Done.", JSON.stringify(summary));

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[sync-jobs] Fatal:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err), summary }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});

async function revalidate(opts: {
  slugs: string[];
  revalidateListing: boolean;
}): Promise<void> {
  const appUrl = Deno.env.get("NEXT_APP_URL");
  const secret = Deno.env.get("REVALIDATION_SECRET");

  if (!appUrl || !secret) {
    console.warn(
      "[sync-jobs] NEXT_APP_URL or REVALIDATION_SECRET not set — skipping revalidation",
    );
    return;
  }

  const res = await fetch(`${appUrl}/api/revalidate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slugs: opts.slugs,
      revalidateListing: opts.revalidateListing,
      secret,
    }),
  });

  if (!res.ok) {
    console.error(`[sync-jobs] Revalidation request failed: ${res.status}`);
  } else {
    console.log(
      `[sync-jobs] Revalidated ${opts.slugs.length} pages, listing=${opts.revalidateListing}`,
    );
  }
}
