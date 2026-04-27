@AGENTS.md

# CLAUDE.md — farmcash-jobs
# Last updated - 23/04/2026

This file is the primary instruction set for any coding agent working in this repository.
Read it fully before making any changes.

---

## Plans

- Make plans extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, list any unresolved questions that need answering before proceeding.
- When implementing a new feature, ensure it does not break existing functionality.

---

## Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run production build locally
npm run start

# Lint
npm run lint

# Migrations: paste SQL into Supabase SQL editor manually — never auto-run
# Migration files live in /supabase/
```

---

## What This Repo Is

`farmcash-jobs` is a Next.js web application serving `farmcash.app/jobs/` — a community-driven
rating and review wiki for reward app offers ("jobs"). It is a standalone web product that shares
a Supabase backend with the FarmCash mobile app.

**It is not a standalone app.** It shares auth, database, and some tables with the mobile app.
Changes to shared tables affect production mobile users. Treat shared DB objects with extreme care.

Full product design is in `/docs/farmcash-jobs-wiki-working-design.md`. Read it before building
any feature.

---

## Routing Architecture

Traffic reaches this app via Cloudflare Worker proxy:
```
farmcash.app/jobs/* → Cloudflare Worker → farmcash-jobs.vercel.app
```

- Do NOT configure a custom domain in Vercel. Cloudflare handles routing.
- All internal Next.js routes must be prefixed with `/jobs` or use `basePath: '/jobs'` in
  `next.config.js`. Confirm this is set before building any pages.
- The root of this app (`/`) is never directly user-facing. `/jobs` is the effective root.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) — shared with mobile app |
| Auth | Supabase Auth — shared with mobile app |
| Hosting | Vercel (hobby plan) |
| Markdown | react-markdown |

---

## Repository Structure

```
/app                  → Next.js App Router pages
  /jobs               → listing page (all offers)
  /jobs/[slug]        → individual job page
  /jobs/admin         → moderation panel (auth-gated)
  /api                → API routes (revalidation, etc.)
/components           → shared React components
/lib                  → Supabase client, utility functions
/docs                 → design docs and architecture references
/scripts              → enrichment pipeline scripts (not served)
/supabase             → migration files (reference only — run manually)
```

---

## Database Rules

### Shared Supabase Project
This app reads and writes to the same Supabase project as the FarmCash mobile app.

**Tables owned by this repo (safe to modify):**
- `public.jobs`
- `public.job_ratings`
- `public.job_comments`
- `public.job_ratings_summary` (materialized view)

**Tables owned by mobile app (READ ONLY — never modify structure):**
- `public.users` — FK target for user references
- `public.job_completions` — view over `postback_log`; used for rating eligibility checks
- `public.postback_log` — do not touch
- All other `public.*` tables not listed above

### FK Pattern
Foreign keys to users reference `public.users(id)`, not `auth.users(id)`.
Follow this pattern consistently.

### Migration Files
- Named: `MIGRATION0XX_description.sql`
- Run manually in Supabase SQL editor — no CLI migration runner is in use
- Never auto-run migrations. Always output the SQL file for human review.
- Current migration count: 019. Next migration is `MIGRATION020_*.sql`.

### Never
- Drop or alter columns on shared tables
- Disable RLS on any table
- Write raw SQL that bypasses RLS outside of `service_role` context

---

## Auth

Supabase Auth is shared with the mobile app. Users who sign in on the web are the same users
as in the app.

- Use `@supabase/ssr` for server-side auth in Next.js App Router
- Client-side: `@supabase/supabase-js`
- Auth session is managed via cookies (SSR pattern)
- The `/jobs/admin` route must be gated: check `auth.users` role or a separate admin flag —
  confirm approach before building

**Phase 1 rating eligibility:** Email-verified Supabase user only. No completion check yet.

**Phase 2 (future):** Gate ratings on `public.job_completions` — user must have ≥2 completed
entries with matching `offer_id`. The `≥2` threshold exists because AyeT's first task is a
~30-second tracking ping that credits 0 seeds and is not meaningful engagement.

---

## ISR + Revalidation Pattern

Job pages are statically generated with ISR. The database is the source of truth — pages are
built from DB data, not the other way around.

- `farmcash.app/jobs` (listing) — revalidate every 6 hours
- `farmcash.app/jobs/[slug]` (job page) — revalidated on-demand when job data changes
- Ratings and comments are dynamic (client-side or server component fetch, not cached)

The sync Edge Function (AyeT → `jobs` table) must call `/api/revalidate?slug={slug}&secret={token}`
after any job update. Implement this revalidation endpoint early — the sync job depends on it.

---

## Styling Notes

- Use Tailwind utility classes only
- Do not hardcode brand colours as hex values. Use CSS variables:
  - `var(--color-primary)` — FarmCash green
  - `var(--color-secondary)` — FarmCash gold
- **Homepage redesign is in progress.** Do not over-invest in visual polish or theme tokens now.
  Build functional UI with the variables above. Reskinning will happen in a separate pass.
- Keep components clean and theme-agnostic so reskinning is a variable swap, not a rebuild.

---

## Rating Dimensions

All ratings are 1–5 scale. Direction is consistent: **higher is always better for the user.**

| Dimension | 1 | 5 |
|---|---|---|
| `overall_rating` | Very poor | Excellent |
| `ad_aggression` | Very aggressive ads | No/few ads |
| `task_difficulty` | Very hard | Very easy |
| `payment_speed` | Very slow | Very fast |

Never invert this scale in UI or aggregation logic.

---

## Job Lifecycle Statuses

| Status | UI Behaviour |
|---|---|
| `active` | Full page, CTA shown |
| `partner_removed` | Page stays up, CTA hidden, notice shown |
| `blacklisted` | Returns 404 — excluded from listing, sitemap, and static params. Restores automatically if set back to active. |
| `seasonal` | Page stays up, note shown |
| `under_review` | Hidden from listing, page still accessible by direct URL |

**Pages are never deleted.** SEO value and community ratings must persist regardless of status.

---

## Content Enrichment Pipeline

The enrichment pipeline lives in `/scripts/` and runs separately from the web app.
It is NOT part of the Next.js build. Do not import enrichment scripts into app code.

Pipeline per job:
1. Scrape Play Store via `google-play-scraper` using `app_package_id`
2. Analyse reviews with Claude API → extract dimension signals
3. Generate description, tips, bot ratings, bot comments
4. Write to DB (`is_bot = true` on all AI-generated ratings/comments)
5. Set `enriched_at` timestamp on job record

Bot-generated content must always be marked `is_bot = true`. Never present bot content
as human-generated in the UI.

Media (icons, screenshots) will eventually live in Cloudflare R2. Until that pipeline is built,
store Play Store CDN URLs in `icon_url`. A future migration will update these to R2 URLs.

---

## Deep Link Prep (Phase 3 — not building yet)

Deep linking from web → app is deferred. But do these now to avoid regret:
- Populate `jobs.app_package_id` for all offers at sync time
- Use `jobs.id` (our UUID) in internal references; use `partner_offer_id` for deep link key
- Add `public/.well-known/assetlinks.json` as an empty placeholder file

---

## Git Workflow

- Default branch: `main` — protected, deploys to production via Vercel
- Feature branches: `dev/description` (e.g. `dev/sync-edge-function`)
- Never commit directly to `main`
- Never commit `.env` or `.env.local`
- Keep `SUPABASE_SERVICE_ROLE_KEY` out of any client-side code

---

## Environment Variables

| Variable | Used In |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only / scripts |
| `ANTHROPIC_API_KEY` | Scripts only |
| `REVALIDATION_SECRET` | `/api/revalidate` endpoint |

`NEXT_PUBLIC_*` variables are safe to expose to the browser.
`SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` must never appear in client-side code.

---

## Tracking & Analytics

Please include gtag + gtm inits in our theme files so we have basic tracking from the start and can expand our tracking granulatrity later with GTM + GA4 events.

- Tracking - GA4
- Tracking Tools - Google Tag Manager


# GA4 Details
Stream Name
FarmCash.app (WEB)
Stream URL
https://farmcash.app
Stream ID
13595542630
Measurement Id
G-GXWH94NT6C

# GTM Details
Container:
www.farmcash.app
Web	
GTM-P7WX8DL7

---

## Coding Principles

- TypeScript strictly — no `any` unless absolutely necessary, always add a comment explaining why
- Prefer server components for data fetching; use client components only for interactivity
- Keep components small and single-purpose
- Comment non-obvious logic, especially anything touching shared DB tables
- Always handle loading and error states in UI components
- Never silently swallow errors — log with context