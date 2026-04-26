import { createClient } from "npm:@supabase/supabase-js@2";
import type { CanonicalOffer } from "../adapters/types.ts";

const MISSING_SYNC_THRESHOLD = 3;
const PROTECTED_STATUSES = ["blacklisted"];

export interface UpsertResult {
  updatedSlugs: string[];
  newCount: number;
  removedSlugs: string[];
}

// ─── Types matching the DB schema after MIGRATION021 ──────────────────────────

interface ExistingOffer {
  id: string;
  job_id: string | null;
  partner_offer_id: string;
  app_package_id: string | null;
  promote_to_wiki: boolean;
  is_active: boolean;
  consecutive_missing_syncs: number;
}

interface ExistingJob {
  id: string;
  slug: string;
  status: string;
  app_package_id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  manual_overrides: Record<string, any>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// Apply only keys not protected by manual_overrides
function applyOverridable(
  updates: Record<string, unknown>,
  overrides: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  if (!(key in overrides)) updates[key] = value;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function upsertOffers(
  offers: CanonicalOffer[],
  partnerId: string,
): Promise<UpsertResult> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date().toISOString();
  const updatedSlugs: string[] = [];
  const removedSlugs: string[] = [];
  let newCount = 0;

  // ── Phase 1: Upsert job_offers ─────────────────────────────────────────────

  // Fetch existing offers to preserve manual promote_to_wiki settings
  const { data: existingOffers, error: fetchErr } = await supabase
    .from("job_offers")
    .select("id, job_id, partner_offer_id, app_package_id, promote_to_wiki, is_active, consecutive_missing_syncs")
    .eq("partner_id", partnerId);
  if (fetchErr) throw new Error(`job_offers fetch: ${fetchErr.message}`);

  const existingByOfferId = new Map(
    (existingOffers as ExistingOffer[]).map((r) => [r.partner_offer_id, r]),
  );

  const offerRows = offers.map((offer) => {
    const existing = existingByOfferId.get(offer.partner_offer_id);
    return {
      partner_id: partnerId,
      partner_offer_id: offer.partner_offer_id,
      app_package_id: offer.app_package_id,
      name: offer.name,
      payout_amount: offer.payout_amount,
      conversion_type: offer.conversion_type,
      cpe_tasks: offer.cpe_tasks,
      tracking_link_template: offer.tracking_link_template,
      landing_page: offer.landing_page,
      // On INSERT: auto-set based on bundle ID presence.
      // On UPDATE: preserve existing value (allows manual override).
      promote_to_wiki: existing?.promote_to_wiki ?? (offer.app_package_id !== null),
      is_active: true,
      consecutive_missing_syncs: 0,
      last_seen_in_partner_api: now,
    };
  });

  if (offerRows.length > 0) {
    const { error: upsertErr } = await supabase
      .from("job_offers")
      .upsert(offerRows, { onConflict: "partner_id,partner_offer_id" });
    if (upsertErr) throw new Error(`job_offers upsert: ${upsertErr.message}`);
  }

  // ── Phase 2: Compute payout ranges per app_package_id ─────────────────────
  // Re-fetch all active promote_to_wiki offers for this partner (post-upsert state).
  // Grouped by app_package_id to build payout_min/max and pick the best offer for
  // display fields (conversion_type, cpe_tasks).

  const { data: activePromoted, error: apErr } = await supabase
    .from("job_offers")
    .select("partner_offer_id, app_package_id, payout_amount, conversion_type, cpe_tasks")
    .eq("partner_id", partnerId)
    .eq("promote_to_wiki", true)
    .eq("is_active", true)
    .not("app_package_id", "is", null);
  if (apErr) throw new Error(`active offers fetch: ${apErr.message}`);

  interface ActiveOffer {
    partner_offer_id: string;
    app_package_id: string;
    payout_amount: number | null;
    conversion_type: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cpe_tasks: any;
  }

  interface PayoutRange {
    min: number;
    max: number;
    bestConversionType: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bestCpeTasks: any;
  }

  const rangeByPackageId = new Map<string, PayoutRange>();
  for (const o of (activePromoted as ActiveOffer[])) {
    const payout = o.payout_amount ?? 0;
    const existing = rangeByPackageId.get(o.app_package_id);
    if (!existing) {
      rangeByPackageId.set(o.app_package_id, {
        min: payout,
        max: payout,
        bestConversionType: o.conversion_type,
        bestCpeTasks: o.cpe_tasks,
      });
    } else {
      rangeByPackageId.set(o.app_package_id, {
        min: Math.min(existing.min, payout),
        max: Math.max(existing.max, payout),
        // Keep fields from whichever offer has the highest payout
        bestConversionType: payout > existing.max ? o.conversion_type : existing.bestConversionType,
        bestCpeTasks: payout > existing.max ? o.cpe_tasks : existing.bestCpeTasks,
      });
    }
  }

  // Build lookup: app_package_id → canonical offer data (for new jobs INSERT only)
  const canonicalByPackageId = new Map<string, CanonicalOffer>();
  for (const offer of offers) {
    if (!offer.app_package_id) continue;
    const existing = canonicalByPackageId.get(offer.app_package_id);
    if (!existing || (offer.payout_amount ?? 0) > (existing.payout_amount ?? 0)) {
      canonicalByPackageId.set(offer.app_package_id, offer);
    }
  }

  // ── Phase 3: Upsert jobs wiki entries ─────────────────────────────────────

  const affectedPackageIds = [...rangeByPackageId.keys()];

  if (affectedPackageIds.length > 0) {
    const { data: existingJobsArr, error: jobsFetchErr } = await supabase
      .from("jobs")
      .select("id, slug, status, app_package_id, manual_overrides")
      .in("app_package_id", affectedPackageIds);
    if (jobsFetchErr) throw new Error(`jobs fetch: ${jobsFetchErr.message}`);

    const existingJobsByPackageId = new Map(
      (existingJobsArr as ExistingJob[]).map((j) => [j.app_package_id, j]),
    );

    // Load slug set for collision-safe generation
    const { data: allSlugs } = await supabase.from("jobs").select("slug");
    const slugSet = new Set((allSlugs ?? []).map((r: { slug: string }) => r.slug));

    for (const [packageId, range] of rangeByPackageId) {
      const existingJob = existingJobsByPackageId.get(packageId);
      const canonical = canonicalByPackageId.get(packageId);
      const overrides = existingJob?.manual_overrides ?? {};

      if (!existingJob) {
        // New app — INSERT using best offer from current batch as seed data
        if (!canonical) continue; // promoted offer from a previous sync — no display data available
        const slug = generateSlug(canonical.name, slugSet);
        slugSet.add(slug);

        const { error: insertErr } = await supabase.from("jobs").insert({
          app_package_id: packageId,
          slug,
          name: canonical.name,
          description: canonical.description,
          icon_url: canonical.icon_url,
          screenshots: canonical.screenshots,
          category: canonical.categories?.[0] ?? null,
          status: "active",
          payout_min: range.min,
          payout_max: range.max,
          conversion_type: range.bestConversionType,
          cpe_tasks: range.bestCpeTasks,
          manual_overrides: {},
        });
        if (insertErr) {
          console.error(`[upsert] jobs INSERT failed for ${packageId}:`, insertErr.message);
          continue;
        }
        newCount++;
      } else {
        // Existing app — UPDATE payout range + overridable display fields
        const updates: Record<string, unknown> = {};

        applyOverridable(updates, overrides, "payout_min", range.min);
        applyOverridable(updates, overrides, "payout_max", range.max);
        applyOverridable(updates, overrides, "conversion_type", range.bestConversionType);
        applyOverridable(updates, overrides, "cpe_tasks", range.bestCpeTasks);

        // Update name/icon/screenshots from current batch if not manually overridden
        if (canonical) {
          applyOverridable(updates, overrides, "name", canonical.name);
          applyOverridable(updates, overrides, "icon_url", canonical.icon_url);
          applyOverridable(updates, overrides, "screenshots", canonical.screenshots);
          if (canonical.categories?.[0]) {
            applyOverridable(updates, overrides, "category", canonical.categories[0]);
          }
          // description: never overwritten by sync after initial insert
          // (enrichment pipeline or manual override owns it after first write)
        }

        // Restore to active if it had been marked partner_removed and offers are back
        if (existingJob.status === "partner_removed" && !PROTECTED_STATUSES.includes(existingJob.status)) {
          updates.status = "active";
        }

        if (Object.keys(updates).length > 0) {
          const { error: updateErr } = await supabase
            .from("jobs")
            .update(updates)
            .eq("id", existingJob.id);
          if (updateErr) {
            console.error(`[upsert] jobs UPDATE failed for ${packageId}:`, updateErr.message);
          } else {
            updatedSlugs.push(existingJob.slug);
          }
        }
      }
    }

    // ── Phase 4: Link job_offers.job_id to their jobs rows ──────────────────
    // Re-fetch jobs (includes newly inserted rows) to get all IDs
    const { data: allJobsArr } = await supabase
      .from("jobs")
      .select("id, app_package_id")
      .in("app_package_id", affectedPackageIds);

    for (const job of (allJobsArr ?? []) as Array<{ id: string; app_package_id: string }>) {
      await supabase
        .from("job_offers")
        .update({ job_id: job.id })
        .eq("partner_id", partnerId)
        .eq("app_package_id", job.app_package_id);
    }
  }

  // ── Phase 5: Handle offers missing from this sync ─────────────────────────

  const seenOfferIds = new Set(offers.map((o) => o.partner_offer_id));

  for (const existing of (existingOffers as ExistingOffer[])) {
    if (seenOfferIds.has(existing.partner_offer_id)) continue;

    const newMissing = existing.consecutive_missing_syncs + 1;
    const hitThreshold = newMissing >= MISSING_SYNC_THRESHOLD && existing.is_active;

    const { error } = await supabase
      .from("job_offers")
      .update({
        consecutive_missing_syncs: newMissing,
        ...(hitThreshold ? { is_active: false } : {}),
      })
      .eq("id", existing.id);

    if (error) {
      console.error(`[upsert] missing-sync update failed for ${existing.partner_offer_id}:`, error.message);
      continue;
    }

    // When an offer deactivates, recompute payout range for its job
    if (hitThreshold && existing.job_id) {
      const slug = await recomputeJobPayouts(supabase, existing.job_id);
      if (slug) removedSlugs.push(slug);
    }
  }

  return { updatedSlugs, newCount, removedSlugs };
}

// Recompute payout_min/max for a job after one of its offers went inactive.
// Returns the job slug if the job was marked partner_removed, otherwise null.
async function recomputeJobPayouts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  jobId: string,
): Promise<string | null> {
  const [{ data: job }, { data: activeOffers }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, slug, status, manual_overrides")
      .eq("id", jobId)
      .single(),
    supabase
      .from("job_offers")
      .select("payout_amount, conversion_type, cpe_tasks")
      .eq("job_id", jobId)
      .eq("is_active", true)
      .order("payout_amount", { ascending: false }),
  ]);

  if (!job) return null;
  const overrides = job.manual_overrides ?? {};

  if (!activeOffers || activeOffers.length === 0) {
    // All offers inactive — mark job as partner_removed if not protected
    if (!PROTECTED_STATUSES.includes(job.status)) {
      await supabase
        .from("jobs")
        .update({ status: "partner_removed", payout_min: null, payout_max: null })
        .eq("id", jobId);
      return job.slug;
    }
    return null;
  }

  const payouts = activeOffers.map((o: { payout_amount: number | null }) => o.payout_amount ?? 0);
  const best = activeOffers[0];
  const updates: Record<string, unknown> = {};

  applyOverridable(updates, overrides, "payout_min", Math.min(...payouts));
  applyOverridable(updates, overrides, "payout_max", Math.max(...payouts));
  applyOverridable(updates, overrides, "conversion_type", best.conversion_type);
  applyOverridable(updates, overrides, "cpe_tasks", best.cpe_tasks);

  await supabase.from("jobs").update(updates).eq("id", jobId);
  return null;
}
