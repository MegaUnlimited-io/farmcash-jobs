# FarmCash Offerwall Architecture Overview

> **Version:** 1.0  
> **Last Updated:** March 2026  
> **Status:** Implementation Ready

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Data Flow](#data-flow)
4. [Caching Strategy](#caching-strategy)
5. [Security Model](#security-model)
6. [Partner Integration: AyeT Studios](#partner-integration-ayet-studios)
7. [Server-Side Filtering](#server-side-filtering)
8. [Analytics & Logging](#analytics--logging)
9. [Error Handling](#error-handling)
10. [Related Documents](#related-documents)

---

## Executive Summary

The FarmCash Offerwall system fetches reward offers from AyeT Studios and presents them to users within the mobile app. The architecture prioritizes:

- **Security** — API keys never touch the client; all AyeT requests route through a Supabase Edge Function
- **Performance** — 15-minute client cache enables instant tab switching and offline fallback
- **Flexibility** — Server-side filtering allows hiding competitors, payment-required offers for pre-KYC users, etc.
- **Observability** — All offer requests are logged for debugging and analytics
- **Correctness** — No server-side caching ensures user-specific offer data (progress, completed offers) is always fresh

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FLUTTER APP                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  OfferRepository (Riverpod Provider)                                 │    │
│  │  ├─ fetchOffers() → POST /functions/v1/offerwall-api                │    │
│  │  ├─ getCachedOffers() → Hive local storage                          │    │
│  │  └─ cache TTL: 15 minutes                                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  OfferWallScreen                                                     │    │
│  │  ├─ Offer list (cards with task preview)                            │    │
│  │  ├─ Offer detail modal                                               │    │
│  │  ├─ Pull-to-refresh                                                  │    │
│  │  └─ Impression tracking (fire impression_url on card visible)       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ HTTPS POST
                                     │ { user_id, device_os, country }
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SUPABASE EDGE FUNCTION                                │
│                        /functions/v1/offerwall-api                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  1. Validate request (user exists, required params)                  │    │
│  │  2. Call AyeT Offerwall API (always fresh, user-specific data)      │    │
│  │  3. Apply server-side filters (competitors, pre-KYC restrictions)   │    │
│  │  4. Log request to public.offerwall_requests                        │    │
│  │  5. Return filtered offers                                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Environment Variables:                                                      │
│  ├─ AYET_ADSLOT_ID                                                          │
│  ├─ AYET_PLACEMENT_ID                                                       │
│  └─ AYET_PUBLISHER_API_KEY                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ HTTPS GET
                                     │ + API Key header
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AYET STUDIOS API                                   │
│              https://www.ayetstudios.com/offers/offerwall_api/               │
│                                                                              │
│  Returns: Array of offers with payout already converted to Seeds            │
│  (based on adslot currency configuration: 1000 seeds = $1 USD)              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Offer Fetch Flow

```
┌──────────┐     ┌─────────────┐     ┌─────────────┐     ┌───────────┐
│  User    │     │  Flutter    │     │  Edge Fn    │     │  AyeT     │
│  Action  │     │  App        │     │  (Supabase) │     │  API      │
└────┬─────┘     └──────┬──────┘     └──────┬──────┘     └─────┬─────┘
     │                  │                   │                  │
     │ Opens Offerwall  │                   │                  │
     │─────────────────▶│                   │                  │
     │                  │                   │                  │
     │                  │ Check local cache │                  │
     │                  │ (< 15 min old?)   │                  │
     │                  │───────┐           │                  │
     │                  │       │           │                  │
     │                  │◀──────┘           │                  │
     │                  │                   │                  │
     │          [Cache HIT]                 │                  │
     │◀─────────────────│ Show cached       │                  │
     │  Instant render  │ offers            │                  │
     │                  │                   │                  │
     │                  │ Background fetch  │                  │
     │                  │──────────────────▶│                  │
     │                  │                   │                  │
     │                  │                   │ Call AyeT API    │
     │                  │                   │──────────────────▶
     │                  │                   │                  │
     │                  │                   │◀─────────────────│
     │                  │                   │  Raw offers      │
     │                  │                   │                  │
     │                  │                   │ Apply filters    │
     │                  │                   │ Log request      │
     │                  │◀──────────────────│                  │
     │                  │  Filtered offers  │                  │
     │                  │                   │                  │
     │                  │ Update local cache│                  │
     │                  │ Re-render if diff │                  │
     │◀─────────────────│                   │                  │
     │  Updated offers  │                   │                  │
     │  (if changed)    │                   │                  │
```

### Offer Click Flow

```
┌──────────┐     ┌─────────────┐     ┌─────────────┐     ┌───────────┐
│  User    │     │  Flutter    │     │  External   │     │  AyeT     │
│  Action  │     │  App        │     │  Browser    │     │  Tracking │
└────┬─────┘     └──────┬──────┘     └──────┬──────┘     └─────┬─────┘
     │                  │                   │                  │
     │ Taps offer card  │                   │                  │
     │─────────────────▶│                   │                  │
     │                  │                   │                  │
     │                  │ Show detail modal │                  │
     │◀─────────────────│                   │                  │
     │                  │                   │                  │
     │ Taps "Start      │                   │                  │
     │ Offer"           │                   │                  │
     │─────────────────▶│                   │                  │
     │                  │                   │                  │
     │                  │ Launch URL        │                  │
     │                  │──────────────────▶│                  │
     │                  │                   │                  │
     │                  │                   │ tracking_link    │
     │                  │                   │─────────────────▶│
     │                  │                   │                  │
     │                  │                   │  Redirect to     │
     │                  │                   │◀─────────────────│
     │                  │                   │  advertiser      │
     │                  │                   │                  │
     │  [User completes offer in browser]   │                  │
     │                  │                   │                  │
     │                  │                   │                  │
     │                  │      [Later: Postback to OCG]        │
     │                  │                   │                  │
```

---

## Caching Strategy

### Client-Only Cache

AyeT's offerwall API returns **user-specific data** including:
- Offer completion progress (`completed`, `status`, `percentage`)
- Personalized offer list (excluding completed offers)
- User-specific sorting

Because of this, **server-side caching is not used**. Each request to the Edge Function results in a fresh call to AyeT to ensure users always see accurate data.

| Layer | Location | TTL | Key | Purpose |
|-------|----------|-----|-----|---------|
| **Client** | Hive local storage | 15 min | `offers_{user_id}` | Instant UI, offline fallback, reduce refresh spam |

### Cache Behavior Matrix

| Scenario | Client Cache | Action |
|----------|--------------|--------|
| App launch, Offerwall tab | Fresh (<15 min) | Show cached, skip fetch |
| App launch, Offerwall tab | Stale/Empty | Fetch from Edge Fn, show loading |
| Pull-to-refresh | — | Force fetch, bypass cache |
| Return from offer click | — | Background refresh |
| Tab switch (within session) | Fresh | Show cached instantly |

### Why No Server-Side Cache?

1. **User-specific data** — AyeT returns personalized offers based on `external_identifier`
2. **Completion tracking** — CPE task progress is embedded in the response
3. **Correctness over efficiency** — Wrong data is worse than an extra API call
4. **Client cache handles UX** — 15-min client cache provides instant tab switching

---

## Security Model

### API Key Protection

```
┌─────────────────────────────────────────────────────────────────┐
│  ❌ NEVER: API key in Flutter app                               │
│     - APKs can be decompiled                                    │
│     - Keys extracted in minutes                                 │
│     - Rate limits abused, attribution manipulated               │
├─────────────────────────────────────────────────────────────────┤
│  ✅ ALWAYS: API key in Supabase Edge Function env vars          │
│     - Never transmitted to client                               │
│     - Rotatable without app update                              │
│     - Request logging and rate limiting possible                │
└─────────────────────────────────────────────────────────────────┘
```

### Request Validation

The Edge Function validates:

1. **Authentication** — Valid Supabase JWT required
2. **User exists** — `user_id` matches authenticated user
3. **Required params** — `device_os` must be present
4. **Rate limiting** — Max 10 requests per user per minute (prevent abuse)

### IP Passthrough

AyeT uses the requester's IP for geo-verification. The Edge Function must pass through the client's real IP:

```typescript
// Forward client IP to AyeT
const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] 
                 || req.headers.get('cf-connecting-ip');

// Include in AyeT request (via X-Forwarded-For or query param if supported)
```

---

## Partner Integration: AyeT Studios

### API Endpoint

```
GET https://www.ayetstudios.com/offers/offerwall_api/{ADSLOT_ID}
```

### Request Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `external_identifier` | Yes | Supabase user UUID (for postback attribution) |
| `os` | Yes | `android` or `ios` |
| `country` | No | ISO 2-letter code (AyeT auto-detects from IP) |
| `include_cpe` | No | `true` to include multi-event offers |
| `offer_sorting` | No | `ecpm` (recommended), `payout`, `conversion_rate` |
| `min_payout` | No | Minimum USD payout (e.g., `0.05`) |
| `language` | No | ISO 2-letter code for offer descriptions |

### Response Format

AyeT returns offers with payouts **already converted to your configured currency (Seeds)**.

```json
{
  "id": 274785,
  "name": "Home of Horror",
  "icon": "https://dyncdn.ayet.io/...",
  "icon_large": "https://dyncdn.ayet.io/...",
  "conversion_type": "cpe",
  "payout": 363,                          // Already in Seeds!
  "conversion_instructions_short": "...",
  "conversion_instructions_long": "...",
  "rules_requirements": "Only new users...",
  "tracking_link": "https://...",
  "impression_url": "https://...",
  "cpe_instructions": [
    {
      "name": "Sign up for free trial",
      "payout": 60,                       // Already in Seeds!
      "type": "normal"
    }
  ],
  "payment_required": false,
  "offer_complexity": "1"
}
```

### Currency Configuration

- Configured in AyeT dashboard at adslot level
- FarmCash uses: **1000 Seeds = $1.00 USD**
- No client-side conversion needed — use `payout` directly

---

## Server-Side Filtering

The Edge Function applies filters before returning offers to the client.

### Filter Rules

| Rule | Field | Condition | Reason |
|------|-------|-----------|--------|
| **Competitor block** | `name`, `landing_page` | Contains "freecash", "swagbucks", "mistplay" | Don't promote competitors |
| **Pre-KYC: No payment** | `payment_required` | `true` → hide | Risky for unverified users |
| **Pre-KYC: Low payout only** | `payout` | > 5000 seeds → hide | Limit fraud exposure |
| **Platform match** | `platforms` | Must include requested OS | Don't show iOS offers on Android |

### Filter Configuration

Stored in `public.app_config` for easy updates without deploy:

```sql
-- Example config row
INSERT INTO public.app_config (key, value) VALUES 
('offerwall_blocked_keywords', '["freecash", "swagbucks", "mistplay", "cashyy", "rewarded play"]'),
('offerwall_prekyc_max_payout', '5000'),
('offerwall_prekyc_allow_payment_required', 'false');
```

---

## Analytics & Logging

### Offer Request Logging

Every offer fetch is logged to `public.offerwall_requests`:

```sql
CREATE TABLE public.offerwall_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  requested_at TIMESTAMPTZ DEFAULT now(),
  device_os TEXT NOT NULL,
  country TEXT,
  offer_count_raw INT,        -- Before filtering
  offer_count_filtered INT,   -- After filtering
  cache_hit BOOLEAN,
  response_time_ms INT,
  error_message TEXT
);
```

### Impression Tracking

The Flutter app fires `impression_url` when an offer card scrolls into view:

```dart
// Fire once per offer per session
void onOfferVisible(Offer offer) {
  if (offer.impressionUrl != null && !_firedImpressions.contains(offer.id)) {
    _firedImpressions.add(offer.id);
    http.get(Uri.parse(offer.impressionUrl));
  }
}
```

**Why this matters:**
- Affects AyeT's eCPM calculations
- Impacts rev share tier progression
- Advertisers track impression-to-click ratios

---

## Error Handling

### Client-Side Errors

| Scenario | User Experience | Background Action |
|----------|-----------------|-------------------|
| Network timeout | Show stale cache + "Couldn't refresh" toast | Retry on next tab switch |
| Empty response | "No offers available" empty state | Log to analytics |
| Cache empty + network fail | "Check your connection" full-screen | Retry button |

### Server-Side Errors

| Scenario | Response | Action |
|----------|----------|--------|
| AyeT API down | 503 + cached data if available | Alert monitoring |
| Invalid user | 401 Unauthorized | — |
| Rate limited (user) | 429 Too Many Requests | — |
| AyeT rate limited | 503 + retry-after header | Back off |

### AyeT API Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process offers |
| 400 | Bad request | Check params, log |
| 401 | Invalid API key | Alert immediately |
| 429 | Rate limited | Exponential backoff |
| 500+ | AyeT server error | Retry with backoff |

---

## Related Documents

| Document | Description |
|----------|-------------|
| `Offerwall_Testing_Guide.md` | **Start here** — Phased rollout, testing checklist, troubleshooting |
| `Offerwall_Edge_Function_Spec.md` | Full implementation spec for the Supabase Edge Function |
| `Offerwall_Dart_Models_Spec.md` | Flutter/Dart data models and repository pattern |
| `Offerwall_UI_Spec.md` | UI components, field mappings, and visual reference |
| `Offer_Completion_Gateway_v1.md` | Postback handling (separate system) |
| `ayetstudios_api_guide.md` | AyeT API reference |
| `ayet-offerwall-test.html` | HTML test page (dual-mode: Direct AyeT / Edge Function) |
| `config.txt` | Test page configuration template |

---

## Appendix: Decision Log

| Decision | Rationale | Date |
|----------|-----------|------|
| Web-first testing | Faster iteration, catch issues before Flutter | Mar 2026 |
| Dev auth bypass (X-Test-Key) | Test Edge Function without full Supabase auth | Mar 2026 |
| **No server-side cache** | AyeT returns user-specific data (progress, completed offers); caching would show stale/wrong data | Mar 2026 |
| Client-only cache (15 min) | Handles UX (instant tab switching), user-specific by nature | Mar 2026 |
| External browser for offer clicks | Better advertiser trust, cookie persistence | Mar 2026 |
| No client-side seed conversion | AyeT returns values in configured currency | Mar 2026 |
| Competitor filtering server-side | Can't trust client; easy to update | Mar 2026 |
| Impression tracking on visibility | AyeT recommendation; affects eCPM | Mar 2026 |