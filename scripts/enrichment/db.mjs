import { createClient } from "@supabase/supabase-js";

const BOT_NAME = "Harvest Intel Bot 🤖";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, key);
}

/**
 * Fetch jobs that haven't been enriched yet.
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
export async function getUnenrichedJobs(limit = 50) {
  const db = getClient();
  const { data, error } = await db
    .from("jobs")
    .select("id, name, app_package_id, payout_min, payout_max, manual_overrides, enriched_at")
    .not("app_package_id", "is", null)
    .is("enriched_at", null)
    .in("status", ["active", "partner_removed", "seasonal"])
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`getUnenrichedJobs: ${error.message}`);
  return data ?? [];
}

/**
 * Fetch a single job by UUID.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getJobById(id) {
  const db = getClient();
  const { data, error } = await db
    .from("jobs")
    .select("id, name, app_package_id, payout_min, payout_max, manual_overrides, enriched_at")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

/**
 * Fetch a single job by app_package_id.
 * @param {string} appPackageId
 * @returns {Promise<object|null>}
 */
export async function getJobByPackageId(appPackageId) {
  const db = getClient();
  const { data, error } = await db
    .from("jobs")
    .select("id, name, app_package_id, payout_min, payout_max, manual_overrides, enriched_at")
    .eq("app_package_id", appPackageId)
    .single();
  if (error) return null;
  return data;
}

/**
 * Write enrichment results back to the DB.
 * Respects manual_overrides on the jobs table.
 * Deletes + re-inserts bot rating and comment (idempotent on --force).
 *
 * @param {string} jobId
 * @param {import('./scraper.mjs').PlayStoreData|null} playStoreData
 * @param {object} analysis  - Output from analyseJob()
 * @param {boolean} dryRun
 */
export async function writeEnrichmentResult(jobId, playStoreData, analysis, dryRun = false) {
  const db = getClient();

  // ── 1. Fetch current manual_overrides ──────────────────────────────────────
  const { data: job, error: jobErr } = await db
    .from("jobs")
    .select("manual_overrides")
    .eq("id", jobId)
    .single();
  if (jobErr) throw new Error(`writeEnrichmentResult fetch job: ${jobErr.message}`);

  const overrides = job.manual_overrides ?? {};

  // ── 2. Build job update (skip any field in manual_overrides) ──────────────
  const jobUpdate = { enriched_at: new Date().toISOString() };
  if (playStoreData) {
    if (!overrides.description && analysis.description)
      jobUpdate.description = analysis.description;
    if (!overrides.icon_url && playStoreData.icon)
      jobUpdate.icon_url = playStoreData.icon;
    if (!overrides.screenshots && playStoreData.screenshots?.length)
      jobUpdate.screenshots = playStoreData.screenshots;
    if (!overrides.category && playStoreData.category)
      jobUpdate.category = playStoreData.category;
  }

  if (dryRun) {
    console.log(`  [dry-run] job update:`, jobUpdate);
    console.log(`  [dry-run] rating:`, {
      ad_aggression: analysis.ad_aggression,
      task_difficulty: null,
      payment_speed: null,
      confidence: analysis.confidence,
    });
    console.log(`  [dry-run] comment:`, analysis.comment);
    return;
  }

  // ── 3. Update jobs row ────────────────────────────────────────────────────
  const { error: updateErr } = await db
    .from("jobs")
    .update(jobUpdate)
    .eq("id", jobId);
  if (updateErr) throw new Error(`jobs update: ${updateErr.message}`);

  // ── 4. Upsert bot rating (delete + insert for clean idempotency) ──────────
  // Delete by is_bot only (not bot_name) so renames/emoji changes don't leave orphaned rows.
  await db
    .from("job_ratings")
    .delete()
    .eq("job_id", jobId)
    .eq("is_bot", true);

  const { error: ratingErr } = await db.from("job_ratings").insert({
    job_id: jobId,
    user_id: null,              // null for bots — see MIGRATION022
    is_bot: true,
    bot_name: BOT_NAME,
    ad_aggression: analysis.ad_aggression,
    task_difficulty: null,      // can't reliably derive from Play Store reviews
    payment_speed: null,        // requires human farmers who completed the offer
    // overall_rating computed by DB trigger (= ad_aggression only until humans rate)
  });
  if (ratingErr) throw new Error(`job_ratings insert: ${ratingErr.message}`);

  // ── 5. Upsert bot comment (delete + insert) ───────────────────────────────
  await db
    .from("job_comments")
    .delete()
    .eq("job_id", jobId)
    .eq("is_bot", true);

  const { error: commentErr } = await db.from("job_comments").insert({
    job_id: jobId,
    user_id: null,          // null for bots — see MIGRATION022
    is_bot: true,
    bot_name: BOT_NAME,
    content: analysis.comment,
    is_guide: false,
    is_pinned: false,
    status: "approved",
  });
  if (commentErr) throw new Error(`job_comments insert: ${commentErr.message}`);
}
