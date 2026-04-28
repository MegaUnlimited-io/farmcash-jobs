# FarmCash Jobs — Feature Backlog
_Last updated: 2026-04-28_

Items are grouped by theme, not strict priority order. Each entry notes dependencies and rough complexity. Nothing here is scoped or committed — it's a parking lot for ideas worth building eventually.

---

## Priority: High

### B-01 · Deep Link — Web → Mobile App
Route the CTA button to a deep link that opens the relevant offer directly inside the FarmCash app. Currently the button is a placeholder toast.

- **Depends on:** `jobs.app_package_id` (already populated), `partner_offer_id` (already stored), Android App Links (`assetlinks.json` placeholder already in place)
- **Notes:** AyeT tracking link template is stored in `tracking_link_template`. Phase 1 = open app to offer. Phase 2 = attribute the click through AyeT web tracking so seeds credit correctly.
- **Complexity:** Medium — needs Android/iOS scheme registration + Cloudflare Worker passthrough for `.well-known`

---

### B-11 · `award_action` — Secure, Idempotent Reward RPC
A single reusable Supabase RPC function for awarding seeds/XP to users for interactions on the jobs wiki. Required foundation for ratings rewards, comment thumbs, achievements, and anything else that grants value.

- **Design requirements:**
  - Server-side only — reward amounts defined in a backend config table, never passed from client
  - Idempotent — `(user_id, action_key, entity_id)` unique constraint; calling twice is a no-op
  - Returns `{ awarded: boolean, seeds: number, xp: number }` — caller shows feedback
  - Action registry table: `award_actions(action_key TEXT PK, seeds INT, xp INT, enabled BOOL)`
  - Must be tamper-proof: client sends `action_key` + `entity_id` only, never the reward value
- **Affects:** B-07 (rating rewards), B-09 (thumbs), B-10 (achievements)
- **Complexity:** Medium-High — needs careful RLS + RPC design, migration, shared auth contract with mobile

---

## Priority: Medium

### B-02 · Categories System
First-class job categories shown in listing filters and on job pages. Partner categories + Play Store genre used as signals; AI infers a canonical FarmCash category during enrichment; manual override available in admin.

- **Phase 1:** Enrichment pipeline tags `category` field using Claude API (Play Store genre + partner category as context). Canonical category list defined by us.
- **Phase 2:** Admin manual override via the override editor (extend `manual_overrides` to include `category`, or a dedicated `category` column).
- **Phase 3:** Listing page filter by category.
- **Depends on:** Enrichment pipeline (done), `manual_overrides` editor (done)
- **Complexity:** Medium — category taxonomy design is the hard part, code is straightforward

---

### B-03 · Comment Formatting
Lightweight rich text in community comments. No heavy editor — a small subset of formatting only.

- **Suggested approach (for coding agent):** Evaluate `markdown-it` (already have `react-markdown`) vs a tiny BBCode parser. Recommend scoping to: `**bold**`, line breaks, `> blockquote`, and possibly a simple table syntax. No images, no links (XSS risk).
- **Must sanitize server-side** before storing — strip disallowed tags at insert time, not render time.
- **Complexity:** Low-Medium — parsing is easy, sanitization is the critical piece

---

### B-04 · Guides System
Elevate high-quality approved comments to "Guide" status. Guides appear in a dedicated section on the job detail page above regular comments, with distinct visual treatment.

- **`is_guide` flag already exists** on `job_comments` table and in types.
- **Admin action:** Pin/guide toggle in moderation queue (10.5 in current dev plan — partially covers this).
- **Detail page:** Add a "Guides" section above the comment list that shows only `is_guide = true` approved comments with a card-style treatment.
- **Complexity:** Low — mostly UI, data model already exists

---

### B-05 · Guide Hunter (AI Agent)
Automated agent that searches Reddit (and possibly YouTube descriptions) for existing community guides about a job's app, rewrites them into FarmCash's voice, and submits them as bot comments for admin review before publishing.

- **Flow:** Cron/manual trigger → search Reddit API for `{app_name} guide tips` → fetch top threads → Claude rewrites into guide format → insert as `job_comments` with `is_bot = true`, `status = 'pending'` → admin reviews in moderation queue before approving
- **Depends on:** Reddit API access (free tier), Claude API (already in use), moderation queue (done)
- **Notes:** All AI-generated guides must be `is_bot = true`. Never publish without admin approval.
- **Complexity:** Medium — Reddit API + prompt design + pipeline script (like enrichment)

---

### B-06 · Favorites — Save Jobs Across Web and App
Users can favorite a job on the web wiki. Favorites sync to a "My Jobs" tab in the mobile app, enabling planning and tracking outside the app.

- **New table:** `job_favorites(user_id UUID FK users(id), job_id UUID FK jobs(id), created_at TIMESTAMPTZ)` — shared table, app reads it too
- **Web:** Toggle button on job detail page (heart/bookmark icon, auth-gated)
- **App:** "My Jobs" tab reads `job_favorites` for the logged-in user
- **Depends on:** Shared Supabase auth (done) — this table would be owned by the jobs wiki but readable by the app
- **Complexity:** Low (web) + App team coordination needed for the mobile tab

---

### B-07 · Rating Rewards
Rating a job for the first time awards seeds and/or XP. Editing an existing rating awards nothing. Encourages honest first impressions rather than farming edits.

- **Depends on:** B-11 (`award_action` RPC) — reward is triggered server-side at the moment of first insert, not on update
- **UX:** Show a reward confirmation ("You earned X seeds!") after first-time rating submit
- **Complexity:** Low once B-11 exists

---

### B-08 · Rating Requirements — Task Completion Gate
Gate rating submission on having completed at least 1 paid task (seeds > 0) for that app in the FarmCash app. Prevents fake ratings from users who never tried the offer.

- **Data source:** `public.job_completions` view (already referenced in CLAUDE.md Phase 2 eligibility) — filter by `offer_id` matching `partner_offer_id` and `seeds > 0`
- **Currently:** Phase 1 eligibility = email-verified only (already implemented). This is Phase 2.
- **Complexity:** Low — eligibility check already designed, just needs wiring

---

## Priority: Lower / Exploratory

### B-09 · Thumbs Up / Down on Comments
Simple vote system on approved comments. One vote per user per comment, changeable. Awards small XP on first vote cast (any comment).

- **New table:** `comment_votes(comment_id UUID FK job_comments(id), user_id UUID FK users(id), vote SMALLINT CHECK (vote IN (-1, 1)), created_at TIMESTAMPTZ)` — unique on `(comment_id, user_id)`
- **Aggregated column** on `job_comments`: `thumb_score INT` — updated by trigger or computed on read
- **Depends on:** B-11 (award_action for first-vote XP reward)
- **Complexity:** Medium

---

### B-10 · Sort Comments by Thumb Score
Default sort for comments: `thumb_score DESC` (highest voted first). User can toggle to newest/oldest.

- **Depends on:** B-09 (thumbs system must exist first)
- **Complexity:** Low once B-09 is done

---

### B-12 · Achievements & Badges
Earn achievements for wiki interactions: first rating, 10 ratings, streak days, first comment, guide promoted, etc. Badges displayed on user profile.

- **New tables:** `achievements(key TEXT PK, name TEXT, description TEXT, icon TEXT)`, `user_achievements(user_id, achievement_key, earned_at)`
- **Trigger points:** rating submit, comment approved, guide promoted, thumb cast, etc.
- **Depends on:** B-11 (award_action infrastructure likely reused), B-07, B-09
- **Complexity:** Medium-High — achievement definitions and trigger wiring across multiple actions

---

### B-13 · UI & Branding Pass
Full visual reskin once the FarmCash web presence redesign is complete. Replace placeholder brand tokens in `:root` with final values. Components are already theme-agnostic (CSS variables throughout) — this should be a variable swap, not a rebuild.

- **Blocked on:** FarmCash.app web redesign (external dependency)
- **Complexity:** Low-Medium once design tokens are finalized

---

## Notes for Future Coding Agents

- **Shared DB objects** (tables read by the mobile app) require coordination — never modify `public.users`, `public.postback_log`. New shared tables (like `job_favorites`) should be added via a new migration and flagged in `CLAUDE.md`.
- **B-11 (`award_action`) should be built before B-07, B-09, B-12** — it's the foundation. Don't implement ad-hoc seed/XP grants in individual features.
- **All AI-generated content must be `is_bot = true`** and pass through admin moderation (`status = 'pending'`) before publishing.
- **Rating scale is always 1–5, higher = better for the user.** Never invert.
