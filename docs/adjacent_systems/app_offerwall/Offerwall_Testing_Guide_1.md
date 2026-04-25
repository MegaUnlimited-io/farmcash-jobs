# FarmCash Offerwall Testing Guide

> **Version:** 1.0  
> **Last Updated:** March 2026  
> **Status:** Ready for Phase 1

---

## Overview

This guide covers the phased testing and rollout of the FarmCash offerwall feature. We use a **web-first approach** — testing the Edge Function via HTML before Flutter integration reduces iteration time and catches issues early.

---

## Rollout Phases

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: Direct AyeT Testing (CURRENT)                                     │
│  ├─ Test HTML page directly against AyeT API                                │
│  ├─ Validate offer data structure, UI rendering                             │
│  └─ ✅ COMPLETE                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 2: Edge Function Development & Testing                               │
│  ├─ Deploy Edge Function to Supabase                                        │
│  ├─ Test via HTML page (Edge Function mode)                                 │
│  ├─ Validate caching, filtering, logging                                    │
│  └─ Iterate on filter rules                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 3: Flutter Integration                                               │
│  ├─ Implement Dart models and repository                                    │
│  ├─ Build UI components                                                     │
│  ├─ Integrate with Edge Function                                            │
│  └─ Test on device                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 4: Beta Testing                                                      │
│  ├─ Reduce cache TTL (60min → 5min)                                         │
│  ├─ Remove DEV_TEST_KEY from production                                     │
│  ├─ Test with real users                                                    │
│  └─ Monitor analytics                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 2: Edge Function Testing

### Prerequisites

1. **Supabase Project** with Edge Functions enabled
2. **AyeT Dashboard** access (adslot configured)
3. **Local Python server** for HTML test page

### Step 1: Deploy Edge Function

```bash
# 1. Create the function directory
mkdir -p supabase/functions/offerwall-api

# 2. Copy the implementation from Offerwall_Edge_Function_Spec.md
# to supabase/functions/offerwall-api/index.ts

# 3. Set environment variables
supabase secrets set AYET_ADSLOT_ID=your_adslot_id
supabase secrets set AYET_PLACEMENT_ID=your_placement_id
supabase secrets set AYET_PUBLISHER_API_KEY=your_api_key

# 4. Set dev test key (for HTML test page auth bypass)
supabase secrets set DEV_TEST_KEY=your-random-key-here

# 5. Deploy
supabase functions deploy offerwall-api
```

### Step 2: Create Database Tables

Run in Supabase SQL Editor:

```sql
-- Offer request logging
CREATE TABLE IF NOT EXISTS public.offerwall_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  device_os TEXT NOT NULL,
  country TEXT,
  offer_count_raw INT,
  offer_count_filtered INT,
  response_time_ms INT,
  error_message TEXT
);

CREATE INDEX idx_offerwall_requests_requested_at 
  ON public.offerwall_requests(requested_at DESC);

ALTER TABLE public.offerwall_requests ENABLE ROW LEVEL SECURITY;

-- App config for filter rules
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default filter config
INSERT INTO public.app_config (key, value) VALUES
  ('offerwall_blocked_keywords', '["freecash", "swagbucks", "mistplay", "cashyy", "rewarded play", "justplay", "buff"]'),
  ('offerwall_prekyc_max_payout', '5000'),
  ('offerwall_prekyc_allow_payment_required', 'false')
ON CONFLICT (key) DO NOTHING;
```

### Step 3: Configure Test Page

Update your `config.txt`:

```ini
# AyeT credentials (still needed for reference)
ADSLOT_ID=your_actual_adslot_id
PLACEMENT_ID=your_placement_id

# Edge Function settings
SUPABASE_URL=https://your-project.supabase.co
DEV_TEST_KEY=your-random-key-here

# Other settings...
DEFAULT_OS=android
DEFAULT_COUNTRY=US
SEEDS_PER_DOLLAR=1000
TEST_USER_ID=test-user-001
```

### Step 4: Run Test Page

```powershell
# Navigate to test page directory
cd C:\path\to\test-page

# Start local server
python -m http.server 8080

# Open in browser
# http://localhost:8080/ayet-offerwall-test.html
```

### Step 5: Test Edge Function

1. **Verify mode toggle** — "Edge Function" radio should be selected (auto-selected if config has Supabase URL)

2. **Click "Fetch Offers"** — Should show loading, then offers

3. **Check Debug Panel** — Verify:
   - Request shows POST method with X-Test-Key header
   - Response shows `success: true`, `meta.total_raw`, `meta.total_filtered`, `meta.dev_mode`

4. **Verify filtering:**
   - Compare `meta.total_raw` vs `meta.total_filtered`
   - Should be fewer filtered (competitors removed)

5. **Check Supabase logs:**
   - Go to Supabase Dashboard → Logs → Edge Functions
   - Look for `[FETCH]` and `[DEV MODE]` messages

6. **Check database:**
   ```sql
   SELECT * FROM public.offerwall_requests ORDER BY requested_at DESC LIMIT 10;
   ```

---

## Testing Checklist

### Edge Function Tests

| Test | Expected Result | Status |
|------|-----------------|--------|
| **Auth: Missing test key** | 401 error | ⬜ |
| **Auth: Invalid test key** | 401 error | ⬜ |
| **Auth: Valid test key** | 200 + offers | ⬜ |
| **Fetch: Returns offers** | Non-empty offers array | ⬜ |
| **Fetch: Has meta info** | total_raw, total_filtered, fetched_at | ⬜ |
| **Filter: Competitors blocked** | FreeCash etc. not in offers | ⬜ |
| **Filter: total_raw > total_filtered** | Some offers filtered | ⬜ |
| **Logging: Request logged** | Row in offerwall_requests | ⬜ |
| **Error: Invalid device_os** | 400 error | ⬜ |

### UI Tests

| Test | Expected Result | Status |
|------|-----------------|--------|
| Offers render correctly | Cards with icon, name, badge, tasks | ⬜ |
| Seed amounts correct | Not multiplied by 1000 | ⬜ |
| USD values correct | payout / 1000 | ⬜ |
| Task preview shows 2 tasks | "+N more tasks" for rest | ⬜ |
| Offer detail modal works | All fields populated | ⬜ |
| Rules warning shows | Orange callout visible | ⬜ |
| Filter chips work | Offers filter correctly | ⬜ |
| Stats bar accurate | Counts match | ⬜ |

---

## Troubleshooting

### CORS Errors

If you see CORS errors in Direct AyeT mode:
- Expected — AyeT doesn't allow browser requests
- Use Edge Function mode instead (that's the point!)

### Edge Function 401 Error

1. Check `DEV_TEST_KEY` is set in Supabase secrets
2. Check `X-Test-Key` header value matches
3. Check function is deployed: `supabase functions list`

### Edge Function 500 Error

1. Check Supabase logs: Dashboard → Logs → Edge Functions
2. Common issues:
   - Missing `AYET_ADSLOT_ID` secret
   - AyeT API key invalid
   - Database tables not created

### Offers Not Filtering

1. Check `app_config` table has rows
2. Verify `offerwall_blocked_keywords` JSON is valid
3. Check offer names/landing pages contain the keywords

---

## Phase 3 Preparation

Once Edge Function testing is complete, proceed to Flutter integration using:

1. **Offerwall_Dart_Models_Spec.md** — Copy/adapt the Dart models
2. **Offerwall_UI_Spec.md** — Reference for UI implementation
3. Remove `DEV_TEST_KEY` — Flutter will use real JWT auth

---

## Security Reminders

⚠️ **Before Production:**

1. **Remove DEV_TEST_KEY** from Supabase secrets
   ```bash
   supabase secrets unset DEV_TEST_KEY
   ```

2. **Review blocked keywords** — add any new competitors

3. **Enable RLS** on all tables (already done in schema)

4. **Remove config.txt** from any public repos (contains keys)