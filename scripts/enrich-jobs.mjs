/**
 * Harvest Intel Bot — enrichment runner
 *
 * Usage:
 *   node --env-file=.env.local scripts/enrich-jobs.mjs [flags]
 *
 * Flags:
 *   --limit N          Max jobs to process (default: 20)
 *   --job <uuid>       Target a specific job by DB UUID (repeatable)
 *   --package <id>     Target a specific job by app_package_id (repeatable)
 *   --force            Re-enrich jobs that already have enriched_at set
 *   --dry-run          Print what would be written, don't touch the DB
 *   --reviews N        Play Store reviews to fetch per job (default: 50)
 *   --model <id>       Claude model ID (default: env ENRICHMENT_MODEL or claude-haiku-4-5-20251001)
 *   --delay N          Milliseconds to wait between jobs (default: 1500)
 */

import { scrapeApp } from "./enrichment/scraper.mjs";
import { analyseJob } from "./enrichment/analyse.mjs";
import {
  getUnenrichedJobs,
  getJobById,
  getJobByPackageId,
  writeEnrichmentResult,
} from "./enrichment/db.mjs";

// ── Parse CLI args ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function flag(name) {
  return args.includes(`--${name}`);
}
function flagVal(name, fallback = null) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}
function flagVals(name) {
  const vals = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === `--${name}` && args[i + 1]) vals.push(args[i + 1]);
  }
  return vals;
}

const opts = {
  limit: parseInt(flagVal("limit", "20"), 10),
  jobIds: flagVals("job"),
  packageIds: flagVals("package"),
  force: flag("force"),
  dryRun: flag("dry-run"),
  reviews: parseInt(flagVal("reviews", "50"), 10),
  model: flagVal("model") ?? process.env.ENRICHMENT_MODEL ?? "claude-haiku-4-5-20251001",
  delay: parseInt(flagVal("delay", "1500"), 10),
};

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║   Harvest Intel Bot — Enrichment     ║");
  console.log("╚══════════════════════════════════════╝\n");
  console.log(`  Model:    ${opts.model}`);
  console.log(`  Reviews:  ${opts.reviews} per job`);
  console.log(`  Force:    ${opts.force}`);
  console.log(`  Dry run:  ${opts.dryRun}`);
  console.log();

  // ── Build job list ──────────────────────────────────────────────────────
  let jobs = [];

  if (opts.jobIds.length || opts.packageIds.length) {
    // Explicit targets
    for (const id of opts.jobIds) {
      const job = await getJobById(id);
      if (!job) { console.warn(`  ⚠ Job not found: ${id}`); continue; }
      jobs.push(job);
    }
    for (const pkg of opts.packageIds) {
      const job = await getJobByPackageId(pkg);
      if (!job) { console.warn(`  ⚠ Package not found: ${pkg}`); continue; }
      jobs.push(job);
    }
    // --force implied when targeting specific jobs; still skip if already enriched
    // unless --force is explicitly set
  } else {
    jobs = await getUnenrichedJobs(opts.limit);
  }

  // When --force: include already-enriched jobs (for explicit targets or all)
  if (!opts.force) {
    const before = jobs.length;
    jobs = jobs.filter((j) => !j.enriched_at);
    const skipped = before - jobs.length;
    if (skipped > 0) console.log(`  Skipping ${skipped} already-enriched job(s). Use --force to re-enrich.\n`);
  }

  if (jobs.length === 0) {
    console.log("  Nothing to enrich. All done!\n");
    return;
  }

  console.log(`  Enriching ${jobs.length} job(s)...\n`);

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const prefix = `  [${i + 1}/${jobs.length}] ${job.name} (${job.app_package_id})`;
    process.stdout.write(`${prefix}\n    Scraping Play Store...`);

    try {
      // 1. Scrape
      const playStoreData = await scrapeApp(job.app_package_id, opts.reviews);
      if (!playStoreData) {
        process.stdout.write(` not found on Play Store\n`);
      } else {
        process.stdout.write(` ${playStoreData.reviews.length} reviews\n`);
      }

      // 2. Analyse
      process.stdout.write(`    Analysing with Claude...`);
      const analysis = await analyseJob(job, playStoreData, { model: opts.model });
      process.stdout.write(
        ` done (ads:${analysis.ad_aggression} conf:${analysis.confidence})\n`
      );

      // 3. Write
      process.stdout.write(`    Writing to DB...`);
      await writeEnrichmentResult(job.id, playStoreData, analysis, opts.dryRun);
      process.stdout.write(` ✓\n`);
      succeeded++;
    } catch (err) {
      process.stdout.write(`\n    ✗ Error: ${err.message}\n`);
      failed++;
    }

    // Rate-limit delay between jobs (skip after last)
    if (i < jobs.length - 1) {
      await sleep(opts.delay);
    }
  }

  console.log(`\n  Done. ${succeeded} succeeded, ${failed} failed.\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("\n  Fatal:", err.message);
  process.exit(1);
});
