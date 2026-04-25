# Offerwall Edge Function Implementation Spec

> **Function Name:** `offerwall-api`  
> **Endpoint:** `POST /functions/v1/offerwall-api`  
> **Runtime:** Deno (Supabase Edge Functions)  
> **Version:** 1.2  
> **Status:** Implementation Ready

---

## Overview

This Edge Function serves as a secure proxy between the FarmCash Flutter app and the AyeT Studios Offerwall API. It handles authentication, filtering, and logging.

**Note:** There is no server-side caching. AyeT returns user-specific data (offer completion progress, personalized offer lists), so each request fetches fresh data from AyeT. Client-side caching (15-min TTL in Hive) handles UX optimization.

---

## Authentication Modes

The Edge Function supports two authentication modes:

### 1. Production Mode (JWT)
Standard Supabase JWT authentication via `Authorization: Bearer <token>` header.

### 2. Development Mode (Test Key)
For testing via HTML test page without requiring full auth flow.

| Header | Value | Effect |
|--------|-------|--------|
| `X-Test-Key` | Matches `DEV_TEST_KEY` env var | Bypasses JWT, uses `X-Test-User-Id` as user |
| `X-Test-User-Id` | Any UUID | Simulated user ID for testing |

> ⚠️ **Security:** Set `DEV_TEST_KEY` only in development. Remove or leave unset in production to disable this bypass entirely.

```bash
# Development only
supabase secrets set DEV_TEST_KEY=your-random-dev-key-here

# Production: Don't set this, or set to empty string
supabase secrets unset DEV_TEST_KEY
```

---

## Function Signature

```typescript
// POST /functions/v1/offerwall-api
// Authorization: Bearer <supabase_jwt>

interface RequestBody {
  user_id: string;         // Supabase user UUID (must match JWT)
  device_os: 'android' | 'ios';
  country?: string;        // ISO 2-letter code (optional, AyeT auto-detects)
}

interface ResponseBody {
  success: boolean;
  offers: Offer[];
  meta: {
    total_raw: number;      // Before filtering
    total_filtered: number; // After filtering
    fetched_at: string;     // ISO timestamp
    dev_mode?: boolean;     // True if using X-Test-Key auth
  };
  error?: string;
}
```

---

## Environment Variables

```bash
# ══════════════════════════════════════════════════════════════════════════════
# REQUIRED - AyeT Credentials
# ══════════════════════════════════════════════════════════════════════════════
AYET_ADSLOT_ID=your_adslot_id
AYET_PLACEMENT_ID=your_placement_id  
AYET_PUBLISHER_API_KEY=your_api_key

# ══════════════════════════════════════════════════════════════════════════════
# REQUIRED - Supabase (auto-injected by Supabase)
# ══════════════════════════════════════════════════════════════════════════════
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# ══════════════════════════════════════════════════════════════════════════════
# DEVELOPMENT ONLY - Test Authentication Bypass
# ══════════════════════════════════════════════════════════════════════════════
# Set this to enable X-Test-Key header auth bypass for HTML test page.
# ⚠️  REMOVE OR UNSET IN PRODUCTION!
DEV_TEST_KEY=your-random-dev-key-here
```

---

## Implementation

### File: `supabase/functions/offerwall-api/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// TYPES
// ============================================================================

interface RequestBody {
  user_id: string;
  device_os: "android" | "ios";
  country?: string;
  force_refresh?: boolean;
}

interface AyetOffer {
  id: number;
  name: string;
  description: string;
  icon: string;
  icon_large: string;
  video_url?: string;
  conversion_type: "cpi" | "cpe" | "cpa";
  conversion_instructions_short: string;
  conversion_instructions_long?: string;
  rules_requirements?: string;
  payout: number; // Already in Seeds
  tracking_link: string;
  impression_url?: string;
  landing_page?: string;
  payment_required: boolean;
  offer_complexity?: string;
  platforms?: string[];
  cpe_instructions?: AyetTask[];
  // ... other fields as needed
}

interface AyetTask {
  name: string;
  uuid: string;
  payout: number;
  type: string;
  bonus_task: boolean;
  status: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const AYET_BASE_URL = "https://www.ayetstudios.com/offers/offerwall_api";

// Dev test key for HTML test page (bypasses JWT auth)
const DEV_TEST_KEY = Deno.env.get("DEV_TEST_KEY") || "";

// Blocked keywords for competitor filtering (loaded from DB on first request)
let blockedKeywords: string[] = [];
let filterConfig: {
  preKycMaxPayout: number;
  preKycAllowPaymentRequired: boolean;
} = {
  preKycMaxPayout: 5000,
  preKycAllowPaymentRequired: false,
};

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req: Request) => {
  const startTime = Date.now();
  
  // CORS headers (include dev test headers)
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-test-key, x-test-user-id",
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ========================================================================
    // 1. AUTHENTICATION (supports dev bypass)
    // ========================================================================
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let userId: string;
    let isDevMode = false;

    // Check for dev test key bypass
    const testKey = req.headers.get("X-Test-Key");
    const testUserId = req.headers.get("X-Test-User-Id");

    if (DEV_TEST_KEY && testKey === DEV_TEST_KEY && testUserId) {
      // Dev mode: bypass JWT auth
      userId = testUserId;
      isDevMode = true;
      console.log(`[DEV MODE] Using test user: ${userId}`);
    } else {
      // Production mode: require JWT
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return errorResponse(401, "Missing or invalid Authorization header", corsHeaders);
      }

      // Verify JWT and get user
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return errorResponse(401, "Invalid or expired token", corsHeaders);
      }

      userId = user.id;
    }

    // ========================================================================
    // 2. PARSE & VALIDATE REQUEST
    // ========================================================================

    const body: RequestBody = await req.json();
    
    // Validate user_id matches authenticated user (skip in dev mode)
    if (!isDevMode && body.user_id !== userId) {
      return errorResponse(403, "user_id does not match authenticated user", corsHeaders);
    }
    
    // In dev mode, use the body user_id if provided, otherwise use test user id
    const effectiveUserId = body.user_id || userId;

    if (!body.device_os || !["android", "ios"].includes(body.device_os)) {
      return errorResponse(400, "Invalid or missing device_os", corsHeaders);
    }

    // Get client IP for passthrough to AyeT
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
                     || req.headers.get("cf-connecting-ip")
                     || "unknown";

    // ========================================================================
    // 3. LOAD FILTER CONFIG (if not cached)
    // ========================================================================

    if (blockedKeywords.length === 0) {
      await loadFilterConfig(supabase);
    }

    // ========================================================================
    // 4. FETCH FROM AYET (no server-side cache - user-specific data)
    // ========================================================================

    // Determine user tier for filtering rules
    const userTier = isDevMode ? "new" : await getUserTier(supabase, effectiveUserId);
    
    console.log(`[FETCH] User: ${effectiveUserId}, OS: ${body.device_os}, Tier: ${userTier}`);
    const ayetResult = await fetchFromAyet(body, effectiveUserId, clientIp);
    const offers = ayetResult.offers;
    const rawCount = offers.length;
    console.log(`[FETCH] Received ${rawCount} offers from AyeT`);

    // ========================================================================
    // 5. APPLY FILTERS
    // ========================================================================

    const filteredOffers = applyFilters(offers, body.device_os, userTier);

    // ========================================================================
    // 6. LOG REQUEST
    // ========================================================================

    const responseTimeMs = Date.now() - startTime;
    
    await logRequest(supabase, {
      userId: effectiveUserId,
      deviceOs: body.device_os,
      country: body.country,
      offerCountRaw: rawCount,
      offerCountFiltered: filteredOffers.length,
      responseTimeMs,
      isDevMode,
    });

    // ========================================================================
    // 7. RETURN RESPONSE
    // ========================================================================

    return new Response(
      JSON.stringify({
        success: true,
        offers: filteredOffers,
        meta: {
          total_raw: rawCount,
          total_filtered: filteredOffers.length,
          fetched_at: new Date().toISOString(),
          dev_mode: isDevMode,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Offerwall API error:", error);
    return errorResponse(500, "Internal server error", corsHeaders);
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function errorResponse(status: number, message: string, headers: Record<string, string>) {
  return new Response(
    JSON.stringify({ success: false, error: message, offers: [] }),
    { status, headers: { ...headers, "Content-Type": "application/json" } }
  );
}

async function loadFilterConfig(supabase: any) {
  try {
    const { data: configs } = await supabase
      .from("app_config")
      .select("key, value")
      .in("key", [
        "offerwall_blocked_keywords",
        "offerwall_prekyc_max_payout",
        "offerwall_prekyc_allow_payment_required",
      ]);

    for (const config of configs || []) {
      switch (config.key) {
        case "offerwall_blocked_keywords":
          blockedKeywords = JSON.parse(config.value);
          break;
        case "offerwall_prekyc_max_payout":
          filterConfig.preKycMaxPayout = parseInt(config.value);
          break;
        case "offerwall_prekyc_allow_payment_required":
          filterConfig.preKycAllowPaymentRequired = config.value === "true";
          break;
      }
    }
  } catch (e) {
    console.error("Failed to load filter config:", e);
    // Use defaults
    blockedKeywords = ["freecash", "swagbucks", "mistplay", "cashyy", "rewarded play"];
  }
}

async function getUserTier(supabase: any, userId: string): Promise<string> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("kyc_verified")
      .eq("id", userId)
      .single();

    return profile?.kyc_verified ? "verified" : "new";
  } catch {
    return "new";
  }
}

async function fetchFromAyet(
  params: RequestBody,
  userId: string,
  clientIp: string
): Promise<{ offers: AyetOffer[] }> {
  const adslotId = Deno.env.get("AYET_ADSLOT_ID");
  
  if (!adslotId) {
    throw new Error("AYET_ADSLOT_ID not configured");
  }

  const url = new URL(`${AYET_BASE_URL}/${adslotId}`);
  
  // Required params
  url.searchParams.set("external_identifier", userId);
  url.searchParams.set("os", params.device_os);
  url.searchParams.set("include_cpe", "true");
  url.searchParams.set("offer_sorting", "ecpm");
  
  // Optional params
  if (params.country) {
    url.searchParams.set("country", params.country);
  }

  console.log(`Fetching from AyeT: ${url.toString()}`);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "X-Forwarded-For": clientIp,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`AyeT API error: ${response.status} - ${errorText}`);
    throw new Error(`AyeT API returned ${response.status}`);
  }

  const data = await response.json();
  
  // AyeT returns either an array directly or { offers: [...] }
  const offers = Array.isArray(data) ? data : (data.offers || []);
  
  return { offers };
}

function applyFilters(
  offers: AyetOffer[],
  deviceOs: string,
  userTier: string
): AyetOffer[] {
  return offers.filter((offer) => {
    // 1. Platform filter
    if (offer.platforms && !offer.platforms.includes(deviceOs)) {
      return false;
    }

    // 2. Competitor block
    const nameLower = (offer.name || "").toLowerCase();
    const landingLower = (offer.landing_page || "").toLowerCase();
    
    for (const keyword of blockedKeywords) {
      if (nameLower.includes(keyword) || landingLower.includes(keyword)) {
        return false;
      }
    }

    // 3. Pre-KYC restrictions
    if (userTier === "new") {
      // Block high-payout offers
      if (offer.payout > filterConfig.preKycMaxPayout) {
        return false;
      }

      // Block payment-required offers
      if (offer.payment_required && !filterConfig.preKycAllowPaymentRequired) {
        return false;
      }
    }

    return true;
  });
}

async function logRequest(
  supabase: any,
  data: {
    userId: string;
    deviceOs: string;
    country?: string;
    offerCountRaw: number;
    offerCountFiltered: number;
    responseTimeMs: number;
    isDevMode?: boolean;
    errorMessage?: string;
  }
) {
  try {
    await supabase.from("offerwall_requests").insert({
      user_id: data.isDevMode ? null : data.userId,  // Don't link test users to real user table
      device_os: data.deviceOs,
      country: data.country,
      offer_count_raw: data.offerCountRaw,
      offer_count_filtered: data.offerCountFiltered,
      response_time_ms: data.responseTimeMs,
      error_message: data.errorMessage,
    });
  } catch (e) {
    console.error("Failed to log request:", e);
    // Don't throw - logging failure shouldn't break the request
  }
}
```

---

## Database Schema

### Table: `public.offerwall_requests`

```sql
CREATE TABLE public.offerwall_requests (
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

-- Index for analytics queries
CREATE INDEX idx_offerwall_requests_user_id ON public.offerwall_requests(user_id);
CREATE INDEX idx_offerwall_requests_requested_at ON public.offerwall_requests(requested_at DESC);

-- RLS: Users can't read this table directly
ALTER TABLE public.offerwall_requests ENABLE ROW LEVEL SECURITY;
-- No policies = service role only
```

### Table: `public.app_config` (if not exists)

```sql
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

---

## Deployment

### 1. Set Environment Variables

```bash
supabase secrets set AYET_ADSLOT_ID=your_adslot_id
supabase secrets set AYET_PLACEMENT_ID=your_placement_id
supabase secrets set AYET_PUBLISHER_API_KEY=your_api_key
```

### 2. Deploy Function

```bash
supabase functions deploy offerwall-api
```

### 3. Test

```bash
curl -X POST https://your-project.supabase.co/functions/v1/offerwall-api \
  -H "Authorization: Bearer YOUR_USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "uuid-here", "device_os": "android"}'
```

---

## Rate Limiting

Consider adding rate limiting to prevent abuse. Options:

### Option A: Simple In-Memory (per isolate)

```typescript
const rateLimits = new Map<string, number[]>();
const RATE_LIMIT = 10; // requests
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimits.get(userId) || [];
  const recent = timestamps.filter(t => now - t < RATE_WINDOW);
  
  if (recent.length >= RATE_LIMIT) {
    return false;
  }
  
  recent.push(now);
  rateLimits.set(userId, recent);
  return true;
}
```

### Option B: Database-Backed (persistent)

Use `public.offerwall_requests` table with a query:

```sql
SELECT COUNT(*) FROM public.offerwall_requests
WHERE user_id = $1 AND requested_at > now() - interval '1 minute';
```

---

## Error Scenarios

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Missing auth header | 401 | `{ success: false, error: "Missing or invalid Authorization header" }` |
| Invalid/expired JWT | 401 | `{ success: false, error: "Invalid or expired token" }` |
| user_id mismatch | 403 | `{ success: false, error: "user_id does not match authenticated user" }` |
| Missing device_os | 400 | `{ success: false, error: "Invalid or missing device_os" }` |
| AyeT API down | 500 | `{ success: false, error: "Internal server error" }` |
| Rate limited | 429 | `{ success: false, error: "Too many requests" }` |

---

## Testing Checklist

- [ ] Auth: Rejects missing Authorization header
- [ ] Auth: Rejects invalid JWT
- [ ] Auth: Rejects mismatched user_id
- [ ] Auth: Dev test key bypass works
- [ ] Validation: Rejects missing device_os
- [ ] Validation: Rejects invalid device_os values
- [ ] Fetch: Returns offers from AyeT
- [ ] Fetch: Response includes total_raw and total_filtered counts
- [ ] Filter: Competitor keywords are blocked
- [ ] Filter: Pre-KYC users don't see payment_required offers
- [ ] Filter: Pre-KYC users don't see high-payout offers
- [ ] Logging: Requests are logged to offerwall_requests table
- [ ] Error: AyeT timeout returns appropriate error