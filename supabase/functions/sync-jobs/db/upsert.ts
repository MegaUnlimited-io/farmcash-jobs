import { createClient } from "npm:@supabase/supabase-js@2";
import type { CanonicalOffer } from "../adapters/types.ts";

const MISSING_SYNC_THRESHOLD = 3;

// Statuses that the sync must never auto-restore to 'active'
const PROTECTED_STATUSES = ["blacklisted"];

interface ExistingRow {
  id: string;
  slug: string;
  partner_offer_id: string;
  status: string;
  consecutive_missing_syncs: number;
}

export interface UpsertResult {
  updatedSlugs: string[];   // existing offers that were updated (need page revalidation)
  newCount: number;         // offers inserted for the first time
  removedSlugs: string[];   // offers that just hit the missing-sync threshold
}

export async function upsertOffers(
  offers: CanonicalOffer[],
  partnerId: string,
): Promise<UpsertResult> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Fetch all current DB rows for this partner
  const { data: existing, error: fetchErr } = await supabase
    .from("jobs")
    .select("id, slug, partner_offer_id, status, consecutive_missing_syncs")
    .eq("partner_id", partnerId);

  if (fetchErr) throw new Error(`DB fetch failed: ${fetchErr.message}`);

  const existingRows = (existing ?? []) as ExistingRow[];
  const existingByOfferId = new Map(existingRows.map((r) => [r.partner_offer_id, r]));

  // 2. Load all slugs in the entire table for collision-safe new slug generation
  const { data: allSlugRows } = await supabase.from("jobs").select("slug");
  const slugSet = new Set((allSlugRows ?? []).map((r: { slug: string }) => r.slug));

  const seenOfferIds = new Set(offers.map((o) => o.partner_offer_id));
  const updatedSlugs: string[] = [];
  const removedSlugs: string[] = [];
  let newCount = 0;

  // 3. Build rows to upsert
  const rowsToUpsert = offers.map((offer) => {
    const existing = existingByOfferId.get(offer.partner_offer_id);

    // Never change an existing offer's slug — SEO and rating data depend on it
    const slug = existing?.slug ?? generateSlug(offer.name, slugSet);
    if (!existing) {
      slugSet.add(slug); // Track within this batch to avoid collisions
      newCount++;
    } else {
      updatedSlugs.push(slug);
    }

    return {
      partner_id: partnerId,
      partner_offer_id: offer.partner_offer_id,
      slug,
      name: offer.name,
      description: offer.description,
      icon_url: offer.icon_url,
      conversion_type: offer.conversion_type,
      payout_amount: offer.payout_amount,
      seeds_amount: offer.seeds_amount,
      app_package_id: offer.app_package_id,
      screenshots: offer.screenshots ?? [],
      cpe_tasks: offer.cpe_tasks,
      tracking_link_template: offer.tracking_link_template,
      // Preserve protected statuses; everything else resets to active on reappearance
      status: existing && PROTECTED_STATUSES.includes(existing.status)
        ? existing.status
        : "active",
      consecutive_missing_syncs: 0,
      last_seen_in_partner_api: new Date().toISOString(),
    };
  });

  // 4. Batch upsert
  if (rowsToUpsert.length > 0) {
    const { error: upsertErr } = await supabase
      .from("jobs")
      .upsert(rowsToUpsert, { onConflict: "partner_id,partner_offer_id" });

    if (upsertErr) throw new Error(`Batch upsert failed: ${upsertErr.message}`);
  }

  // 5. Increment missing-sync counter for absent offers
  for (const row of existingRows) {
    if (seenOfferIds.has(row.partner_offer_id)) continue;

    const newCount = row.consecutive_missing_syncs + 1;
    const updates: Record<string, unknown> = {
      consecutive_missing_syncs: newCount,
    };

    // Flip to partner_removed at threshold (budget cap resets will restore to active)
    if (
      newCount >= MISSING_SYNC_THRESHOLD &&
      !PROTECTED_STATUSES.includes(row.status) &&
      row.status !== "partner_removed"
    ) {
      updates.status = "partner_removed";
      removedSlugs.push(row.slug);
    }

    const { error } = await supabase
      .from("jobs")
      .update(updates)
      .eq("id", row.id);

    if (error) {
      console.error(
        `[upsert] Missing-sync update failed for ${row.partner_offer_id}:`,
        error.message,
      );
    }
  }

  return { updatedSlugs, newCount, removedSlugs };
}

function generateSlug(name: string, existing: Set<string>): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);

  if (!existing.has(base)) return base;

  let i = 2;
  while (existing.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
