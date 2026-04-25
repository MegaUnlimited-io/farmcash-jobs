# FarmCash Jobs — Development Plan
_Last updated: 2026-04-24 | Status: Phases 0–3 complete ✓. 1,024 offers in DB. Phase 4 in progress._

## How to use
- `[ ]` = not started · `[~]` = in progress · `[x]` = done
- `[USER]` = requires manual action from user (not Claude)
- **CHECKPOINT** = user verifies before next phase begins

---

## Phase 0 — Foundation
_Install packages, configure routing, Supabase client, brand tokens, analytics._

- [x] 0.1 Install packages: `@supabase/ssr` `@supabase/supabase-js` `react-markdown`
- [x] 0.2 Set `basePath: '/jobs'` in `next.config.ts`
- [x] 0.3 Centralized theme tokens in `app/globals.css` — edit `:root` block to restyle, `@theme inline` mapping layer
- [x] 0.4 Add GA4 (`G-GXWH94NT6C`) + GTM (`GTM-P7WX8DL7`) init scripts to `app/layout.tsx`
- [x] 0.5 Update `app/layout.tsx` metadata (title → "FarmCash Jobs", description)
- [x] 0.6 Create `lib/supabase/server.ts` — `createServerClient` (SSR, async cookies)
- [x] 0.7 Create `lib/supabase/client.ts` — `createBrowserClient` (singleton)
- [x] 0.8 Create `lib/types.ts` — TypeScript types for all tables + `Database` generic type
- [x] 0.9 Add `public/.well-known/assetlinks.json` — empty placeholder for deep link prep

### CHECKPOINT A ✓
> `npm run dev` serves at `localhost:3000/jobs` (basePath active). No TS errors. Supabase client imports without throwing. GTM/GA4 visible in page source.

---

## Phase 1 — Database Migrations
_Create new fields needed by sync. User runs both migrations manually._

- [x] 1.1 Create `docs/supabase/migrations/MIGRATION020_sync_fields.sql`
  - Add to `jobs`: `seeds_amount INT`, `conversion_type TEXT`, `cpe_tasks JSONB`, `tracking_link_template TEXT`
  - Create `public.admins` table with RLS (separate from `public.users` which is mobile app read-only)

- [x] [USER] 1.2 Run `MIGRATION019_jobs_tables_1.sql` in Supabase SQL editor
- [x] [USER] 1.3 Run `MIGRATION020_sync_fields.sql` in Supabase SQL editor
- [x] [USER] 1.4 Tables confirmed in Supabase dashboard, RLS enabled ✓

### CHECKPOINT B ✓
> Tables live, RLS on. Types in `lib/types.ts` verified against schema.

---

## Phase 2 — AyeT Sync Edge Function
_Supabase Edge Function (Deno). Runs on cron every 6h. Multi-partner adapter pattern._

- [x] 2.1 Create `supabase/functions/sync-jobs/adapters/types.ts` — `PartnerAdapter` interface + `CanonicalOffer` type
- [x] 2.2 Create `supabase/functions/sync-jobs/adapters/ayetstudios.ts` — AyeT Static API + field mapper
- [x] 2.3 Create `supabase/functions/sync-jobs/adapters/revu.ts` — stub, not wired
- [x] 2.4 Create `supabase/functions/sync-jobs/db/upsert.ts` — batch upsert, stale detection, budget-cap reset logic
- [x] 2.5 Create `supabase/functions/sync-jobs/index.ts` — orchestrator, single revalidation call at end
- [x] 2.6 Create `supabase/functions/sync-jobs/deno.json`
- [x] 2.X Exclude `supabase/functions/` from `tsconfig.json` (Deno globals don't exist in Node)

- [x] [USER] 2.7 Secrets set in Supabase dashboard (AYET_STATIC_API_KEY, AYET_JOBS_ADSLOT_ID, REVALIDATION_SECRET, NEXT_APP_URL)
- [x] [USER] 2.8 Deployed from project root: `supabase functions deploy sync-jobs`
- [x] [USER] 2.9 Triggered via admin script — 1,024 offers inserted ✓
- [x] [USER] 2.10 jobs table populated (1,024 rows, status=active, partner_id=ayetstudios)
- [ ] [USER] 2.11 Set cron: Supabase dashboard → Edge Functions → sync-jobs → Schedules → `0 */6 * * *`

### CHECKPOINT C ✓
> 1,024 AyeT offers in DB. 404 revalidation error is expected — Next.js app not deployed yet (Phase 4).

---

#### AyeT → CanonicalOffer field map (reference)

| AyeT field | `jobs` column | Notes |
|---|---|---|
| `id` | `partner_offer_id` | |
| `name` | `name` | |
| — | `slug` | Generated: lowercase, hyphenated, collision-safe |
| `icon` | `icon_url` | Play Store CDN URL for now |
| `conversion_type` | `conversion_type` | `cpi` / `cpa` / `cpe` / `cpl` |
| `payout_usd` | `payout_amount` | |
| `currency_amount` | `seeds_amount` | Seeds earned by user |
| `screenshots` | `screenshots` | JSONB array |
| `app_package_id` | `app_package_id` | |
| `tasks` | `cpe_tasks` | JSONB, CPE only |
| `tracking_link` | `tracking_link_template` | Stored for future web attribution |
| `description` | `description` | May be empty — enrichment fills later |
| — | `partner_id` | Hardcoded `'ayetstudios'` |
| — | `status` | Default `'active'` on insert |

---

## Phase 3 — Revalidation API
_Next.js route handler. Called by the sync Edge Function after each changed job._

- [x] 3.1 Create `app/api/revalidate/route.ts`
  - POST, validates `REVALIDATION_SECRET`
  - Accepts `{ slugs: string[], revalidateListing: boolean, secret }` (batch-friendly)
  - Calls `revalidatePath` for each slug + listing if requested
  - Returns 401 on bad secret

---

## Phase 4 — Core Pages (listing + job detail)
_ISR via Next.js 16 `use cache` + `cacheLife`. Functional UI — no visual polish yet._

- [ ] 4.1 Create `lib/db/jobs.ts` — `getJobs()` (listing, excludes `under_review`), `getJobBySlug(slug)`
- [ ] 4.2 Create `app/jobs/page.tsx` — listing, `use cache` + `cacheLife('hours')` (6h)
- [ ] 4.3 Create `app/jobs/[slug]/page.tsx` — job detail, tagged cache for on-demand revalidation
- [ ] 4.4 Create `app/jobs/[slug]/not-found.tsx`
- [ ] 4.5 Create `components/JobCard.tsx` — name, icon, payout, seeds, rating stars, status badge
- [ ] 4.6 Create `components/JobHeader.tsx` — icon, name, conversion type, payout, seeds
- [ ] 4.7 Create `components/StatusBadge.tsx` — renders per `job_lifecycle_statuses` (partner_removed notice, blacklisted label, seasonal note)
- [ ] 4.8 Create `components/CTAButton.tsx` — **disabled placeholder, no href, no AyeT/App Store links**
- [ ] 4.9 Create `components/RatingBar.tsx` — visual bar for each rating dimension (1–5, higher = better)
- [ ] 4.10 Create `components/RatingsSummary.tsx` — reads `job_ratings_summary` view

### CHECKPOINT D
> User browses `/jobs`, sees job cards with real data. Clicks a job, sees detail page. Status badges render correctly (try blacklisted/partner_removed if any exist). CTA button visible but disabled. Listing excludes `under_review` jobs.

---

## Phase 5 — Auth (SSR)
_Supabase Auth via `@supabase/ssr`. Session via cookies. Phase 1: email/password only._

- [ ] 5.1 Create `middleware.ts` — refreshes session on all `/jobs/*` routes
- [ ] 5.2 Create `app/jobs/login/page.tsx` — email + password sign-in form (client component)
- [ ] 5.3 Create `app/api/auth/callback/route.ts` — handles email confirmation redirects
- [ ] 5.4 Create `components/AuthButton.tsx` — login / logout toggle (client component)

### CHECKPOINT E
> User signs in with a Supabase account at `/jobs/login`. Session persists across page navigations. Logout works. Non-auth pages unaffected.

---

## Phase 6 — Ratings + Comments
_Client components for submission. Server components for display._

- [ ] 6.1 Create `lib/db/ratings.ts` — `upsertRating()`, `checkEligibility()` (Phase 1: email-verified)
- [ ] 6.2 Create `lib/db/comments.ts` — `insertComment()`, `getApprovedComments(jobId)`
- [ ] 6.3 Create `app/api/ratings/route.ts` — POST, auth-gated, eligibility check, upsert
- [ ] 6.4 Create `app/api/comments/route.ts` — POST, auth-gated, inserts with `status = 'pending'`
- [ ] 6.5 Create `app/jobs/[slug]/RatingForm.tsx` — 4-dimension form (overall, ad_aggression, task_difficulty, payment_speed), client component
- [ ] 6.6 Create `app/jobs/[slug]/CommentForm.tsx` — text input, client component
- [ ] 6.7 Create `app/jobs/[slug]/CommentsList.tsx` — server component, approved only

### CHECKPOINT F
> Signed-in user submits a rating with all 4 dimensions. Rating summary updates. User submits a comment — it enters pending state (not visible until approved). Unauthenticated user sees prompt to log in instead of forms.

---

## Phase 7 — Admin Panel
_Auth-gated moderation UI. Strategy: confirm admin check approach before building (see open questions)._

- [ ] 7.1 **[Pre-work]** Confirm admin gating strategy with user (see Open Questions below)
- [ ] 7.2 Create `lib/auth/admin.ts` — `isAdmin(userId)` check
- [ ] 7.3 Create `app/jobs/admin/page.tsx` — redirect non-admins, show comment queue
- [ ] 7.4 Create `app/jobs/admin/AdminCommentRow.tsx` — approve / reject actions
- [ ] 7.5 Create `app/api/admin/comments/route.ts` — PATCH (status → approved / rejected)
- [ ] 7.6 Create `app/jobs/admin/jobs/page.tsx` — job status management table
- [ ] 7.7 Create `app/api/admin/jobs/route.ts` — PATCH (status change)

### CHECKPOINT G
> Admin navigates to `/jobs/admin`. Comment queue shows pending comments. Approve → comment appears on job page. Reject → removed from queue. Non-admin user redirected. Job status change takes effect immediately.

---

## Phase 8 — SEO
_Metadata, sitemap, structured data. Done last so content exists to describe._

- [ ] 8.1 Add `generateMetadata()` to `app/jobs/page.tsx` and `app/jobs/[slug]/page.tsx`
- [ ] 8.2 Create `app/jobs/sitemap.ts` — all `active` / `blacklisted` / `partner_removed` / `seasonal` jobs
- [ ] 8.3 Create `app/robots.ts`
- [ ] 8.4 Add JSON-LD (`SoftwareApplication` schema) to job pages
- [ ] 8.5 OG image — static branded fallback + dynamic per-job (optional, time permitting)

---

## MIGRATION021 (end-of-build SQL — note only)
_Run after all features are built. Do not build yet._

- `jobs_featured` table — manually curated featured offers shown at top of `/jobs` listing
  - Columns: `job_id UUID FK jobs(id)`, `display_order INT`, `created_at TIMESTAMPTZ`
  - RLS: service_role full access; anon read
  - Listing page falls back to top-payout `active` jobs when table is empty or missing

---

## Phase 9 — Enrichment Pipeline _(separate session)_
_Scripts in `/scripts/`, not part of Next.js app. Does not block Phase 1–8._

- Play Store scraper → Claude API analysis → generate description / tips / bot ratings + comments
- Write to DB with `is_bot = true`, set `enriched_at`
- Run as batch on top-50 jobs, then ongoing on new jobs

---

## Environment Variables

### Vercel (already set — confirm these exist)
| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Already set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Already set |
| `SUPABASE_SERVICE_ROLE_KEY` | Already set |
| `REVALIDATION_SECRET` | **Set this** — generate with `openssl rand -hex 32` |

### Supabase Edge Function secrets (set before CHECKPOINT C)
| Variable | Notes |
|---|---|
| `AYET_STATIC_API_KEY` | Adslot-specific Static key (NOT Publisher key) — AyeT dashboard → Placements → Edit Adslot |
| `AYET_JOBS_ADSLOT_ID` | From AyeT dashboard |
| `REVALIDATION_SECRET` | **Same value** as Vercel variable |
| `NEXT_APP_URL` | `https://farmcash-jobs.vercel.app` |

---

## Open Questions

| # | Status | Question | Needed by |
|---|---|---|---|
| Q1 | ✓ resolved | Admin gating → separate `public.admins` table (MIGRATION020), not touching `public.users` | Phase 7 |
| Q2 | ✓ resolved | Brand colors → placeholder values in `:root`, reskin pass later | — |
| Q3 | open | Revu API docs (docx → readable format) — needed to validate `CanonicalOffer` type covers Revu | Before Revu integration |

---

## Deferred (out of scope for Phase 1)
- Deep link CTA (Phase 3) — button is placeholder until then
- AyeT web tracking attribution (tied to deep links)
- Revu integration (adapter stub created in Phase 2, not wired)
- Rating eligibility Phase 2 (`job_completions` gate)
