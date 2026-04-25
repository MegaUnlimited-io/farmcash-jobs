# FarmCash Jobs Wiki — Working Design Doc
*Last updated: April 22, 2026*

**TL;DR:** TripAdvisor for reward app offers. Lives at `farmcash.app/jobs/`, shares Supabase with the app, surfaces community ratings/guides to help users pick better jobs. Standalone SEO value from day one; app integration layered in over time.

---

## Infrastructure Status

| Component | Status | Detail |
|---|---|---|
| GitHub repo | ✅ Done | `MegaUnlimited-io/farmcash-jobs` (public) |
| Next.js scaffold | ✅ Done | App Router, TypeScript, Tailwind, pushed to `main` |
| Vercel project | ✅ Done | `farmcash-jobs` on hobby plan, connected to repo, env vars set |
| Vercel env vars | ✅ Done | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Cloudflare Worker | ✅ Done | `farmcash-jobs-router` — proxies `/jobs*` → Vercel |
| Cloudflare route | ✅ Done | `farmcash.app/jobs*` → worker |
| Supabase | ✅ Existing | Shared project — migrations still needed (see schema below) |

**Vercel URL:** `farmcash-jobs.vercel.app` (do not configure custom domain in Vercel — Cloudflare handles routing)

**Deploy pipeline:** Push to `main` → Vercel auto-builds → live at `farmcash.app/jobs/`

---

## Stack

- **Frontend:** Next.js 14 (App Router, ISR) — `farmcash-jobs` repo
- **Backend:** Existing Supabase project (shared DB + Auth with mobile app)
- **Routing:** Cloudflare Worker proxying `/jobs*` to Vercel
- **AI enrichment:** Claude API + `google-play-scraper` (separate enrichment pipeline)
- **Analytics:** GA4

---

## Offer Database Strategy

Rather than proxying AyeT in real time, we maintain our own `jobs` table synced on a schedule. This gives us SEO-stable URLs that survive partner changes, full status control, and a foundation for multi-partner support.

IMPORTANT: very soon we will onboard our second partner. This system needs to be compatible with a multi-partner setup, we will need to map their API response data to our database fields for each partner in our API data ingestion system.

### Job Lifecycle Statuses
| Status | Meaning |
|---|---|
| `active` | In partner API, full CTA shown |
| `partner_removed` | Gone from API; page stays up, CTA hidden |
| `blacklisted` | We removed it (e.g. ad abuse); page stays, clearly labelled |
| `seasonal` | Known temporary absence |
| `under_review` | Flagged internally, hidden from listing |

Pages are **never deleted** — SEO and community content persists.

### Sync Logic
- Supabase Edge Function (cron) pulls full AyeT offer list every 6 hours
- New `offer_id` → insert as `active`
- Missing from 3 consecutive syncs → mark `partner_removed`
- Manual `blacklisted` status is never overwritten by sync

---

## Core Schema (all in `public` schema, Supabase)

**`jobs`**
- `id` VARCHAR — partner's offer ID (e.g. `"280911"`)
- `partner_id` VARCHAR — e.g. `"ayetstudios"`
- `slug` VARCHAR — URL-safe name (e.g. `coffee-pack-sorting-puzzle`)
- `name`, `description`, `category`
- `app_package_id` VARCHAR — e.g. `com.king.coffee` (Play Store + deep link prep)
- `icon_url`, `ai_generated_content` TEXT
- `payout_amount` DECIMAL, `status` VARCHAR
- `last_seen_in_partner_api` TIMESTAMP
- `enriched_at` TIMESTAMP — null = not yet AI-enriched
- `created_at`, `updated_at`

**`job_ratings`**
- `job_id` → `jobs.id`, `user_id` → `auth.users.id`
- `overall_rating`, `fun_factor`, `ad_aggression`, `difficulty` INT (1–5)
- `is_bot` BOOLEAN — true for AI-seeded ratings
- UNIQUE(job_id, user_id)

**`job_comments`**
- `job_id`, `user_id`
- `content` TEXT (markdown), `is_guide` BOOLEAN, `is_pinned` BOOLEAN
- `is_bot` BOOLEAN, `bot_name` VARCHAR
- `status` VARCHAR: `pending` | `approved` | `rejected`

**`job_ratings_summary`** — materialized view
- Aggregate scores per job; refreshed on each new rating write

**`job_completions`** *(already exists)*
- `user_id`, `offer_id`, `partner`, `status`, `completed_at`
- View from postback_log table. Used for rating eligibility (see below)

---

## Rating Eligibility

**Phase 1 (current):** Email-verified Supabase user required. No completion check.

**Phase 2 — Job Engagement Proof Gate:**
User must have ≥2 `completed` entries in `job_completions` for the same `offer_id` to submit a rating.

Rationale: AyeT's first task for most jobs is a ~30-second play event used to verify tracking — it credits 0 seeds and is not meaningful engagement. A ≥2 threshold ensures the user has completed at least one real task beyond the tracking ping.

- Count `job_completions` where `user_id = auth.uid()` AND `offer_id = jobs.id` AND `status = 'completed'`
- `< 2` → locked state ("Complete this job at least twice to leave a rating")
- `≥ 2` → rating form unlocked

Schema already supports this — no migrations needed when Phase 2 ships.

---

## URL Structure

```
farmcash.app/jobs                 → listing (all ~400 offers)
farmcash.app/jobs/[slug]          → individual job page
farmcash.app/jobs/admin           → moderation panel (Phase 1)
farmcash.app/admin                → future unified admin hub (blog + waitlist + jobs)
```

---

## Content Enrichment Pipeline

This is a standalone sub-system, built and run separately from the main wiki build.

### Why ~400 not 20
Skeleton pages for all AyeT offers go live immediately from sync data alone (name, icon, payout, category). Enrichment fills in the rest progressively.

### Enrichment Phases
1. **Skeleton launch** — all ~400 offers, auto-generated from sync, live URLs indexed
2. **Batch enrich (top 50)** — run enrichment pipeline manually against top offers by payout
3. **Ongoing** — sync job detects `enriched_at IS NULL` on new offers → auto-enqueues enrichment

### Per-Job Enrichment Pipeline
Input: `app_package_id` + `job` record

1. **Scrape** — Pull Play Store listing (title, description, screenshots, reviews)
2. **Sentiment** — Claude API analyses top reviews → extracts fun/ad/difficulty signals
3. **Generate** — Claude produces: job description, tips summary, 2–3 bot comments, dimension ratings
4. **Write** — Insert into `jobs.ai_generated_content`, `job_ratings` (`is_bot=true`), `job_comments` (`is_bot=true`)
5. **Mark** — Set `enriched_at` timestamp

Run in batches of 10–20 with delays (Play Store scraper is the rate limit bottleneck, not Claude).

---

## Deep Linking (Phase 3 — deferred, prep now)

Web job pages will eventually have "Start this job in FarmCash →" CTA deep linking into the app.

**Prep to do during Phase 1 build:**
- Populate `jobs.app_package_id` for all offers at sync time
- Use `jobs.id` (offer ID) as deep link key: `farmcash://jobs/{offer_id}`
- Add `.well-known/assetlinks.json` placeholder to `farmcash-public` repo now
- Human-readable slugs in URLs; offer ID used for deep link reliability

---

## App Integration

| Phase | What |
|---|---|
| Phase 1 | Flutter reads `job_ratings_summary` → star ratings in job modal (read-only) |
| Phase 2 | Surface pinned guides in-app; "Read tips" link → web job page |
| Phase 3 | Deep link from web → app job modal |

---

## MVP Scope

**In (Phase 1):**
- ✅ Skeleton pages for all ~400 AyeT offers
- ✅ Offer sync Edge Function (AyeT → `jobs` table, status management)
- ✅ AI-enriched content for top 50 offers
- ✅ Rating widget (overall + fun/ads/difficulty dimensions)
- ✅ Flat comments with guide toggle
- ✅ Bot-seeded ratings + comments for top 50 (`is_bot=true`)
- ✅ `job_completions`-gated ratings (or email-verified fallback)
- ✅ Admin panel at `/jobs/admin` (approve/reject comments, pin guides)
- ✅ SEO basics (meta, OG tags, sitemap, structured data)
- ✅ GA4
- ✅ Deep link prep (assetlinks.json stub, app_package_id in schema)

**Out (Phase 2+):**
- ❌ Deep linking (infra prepped)
- ❌ In-app comment/guide display
- ❌ Search/filters on listing page
- ❌ Multi-partner support (RevU, Prodege)
- ❌ Unified `/admin` hub
- ❌ AI moderation (manual only for now)
- ❌ Comment threading

---

## Coding Agent Task Order

Run agents in this sequence — each phase depends on the previous:

1. **Supabase migrations** — `jobs`, `job_ratings`, `job_comments` tables, `job_ratings_summary` view, RLS policies
2. **AyeT sync Edge Function** — pulls offer list, upserts `jobs` table, manages statuses. Cron every 6h.
3. **Next.js foundation** — Supabase SSR auth setup, shared layout, Tailwind theme tokens (keep generic — homepage redesign coming, don't over-invest in styling now)
4. **Listing + job pages** — `/jobs` index, `/jobs/[slug]` dynamic page with ISR. Skeleton state for unenriched jobs.
5. **Rating + comment UI** — rating widget with eligibility check, comment form, guide toggle
6. **Admin panel** — `/jobs/admin` behind auth guard, comment moderation queue, pin controls
7. **SEO pass** — meta tags, OG, sitemap.xml, robots.txt, structured data (Review schema)
8. **Enrichment pipeline** — separate agent session; builds the batch enrichment script as a standalone tool

---

## Open Questions (decide before UI build)

| Question | Recommendation |
|---|---|
| Top 50 enrichment criteria? | Payout amount descending from AyeT sync data |
| Sync frequency? | 6h default, make it a config var |
| `partner_removed` threshold? | 3 consecutive missed syncs |
| Bot ratings disclosed in UI? | Yes — label clearly, builds trust |
