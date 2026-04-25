# Offerwall API — Backend Reference

> **Function:** `offerwall-api`
> **Endpoint:** `POST https://api.megaunlimited.io/functions/v1/offerwall-api`
> **Runtime:** Supabase Edge Function (Deno)
> **JWT verification:** Disabled at gateway — function handles auth internally

---

## Authentication

Two modes are supported. Only one should be active at a time.

### Production (JWT)
```
Authorization: Bearer <supabase_jwt>
Content-Type: application/json
```

### Development (Test Key bypass)
```
X-Test-Key: <DEV_TEST_KEY secret>
X-Test-User-Id: <any user id string>
Content-Type: application/json
```
Dev bypass is active only when the `DEV_TEST_KEY` environment secret is set. In dev mode, `user_tier` is always forced to `"new"` and the logging row sets `user_id = NULL`.

---

## Request

```json
{
  "user_id": "728e00a9-045b-4fca-9ca4-da74c6f00e14",
  "device_os": "android",
  "country": "US"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `user_id` | string (UUID) | ✅ | Must match authenticated user. In dev mode, any string is accepted. |
| `device_os` | `"android"` \| `"ios"` | ✅ | Used for platform filtering and AyeT API param |
| `country` | string (ISO-2) | No | Passed to AyeT for geo-targeting. AyeT auto-detects if omitted. |

---

## Response

### Success
```json
{
  "success": true,
  "offers": [ ...AyetOffer[] ],
  "meta": {
    "total_raw": 27,
    "total_filtered": 22,
    "fetched_at": "2026-03-12T10:00:00.000Z",
    "dev_mode": true
  }
}
```

### Error
```json
{
  "success": false,
  "error": "Invalid or missing device_os",
  "offers": []
}
```

| HTTP | Scenario |
|---|---|
| 200 | Success (check `success` field) |
| 400 | Missing or invalid `device_os` |
| 401 | Missing/invalid JWT, or bad/absent `X-Test-Key` |
| 403 | `user_id` in body does not match authenticated user |
| 500 | AyeT API unreachable, or unhandled internal error |

### `meta` fields

| Field | Type | Notes |
|---|---|---|
| `total_raw` | int | Offer count returned by AyeT before any filtering |
| `total_filtered` | int | Offer count after server-side filters — this is `offers.length` |
| `fetched_at` | ISO string | Timestamp of the AyeT fetch |
| `dev_mode` | boolean | Present and `true` only in dev mode requests |
| `filter_debug` | object | **Dev mode only.** See [Filter Debug](#filter-debug-dev-mode-only) below. |

---

## Offer Fields

Offers are passed through from AyeT with no mutation. Key fields used by the client:

| Field | Type | Notes |
|---|---|---|
| `id` | int | AyeT offer ID |
| `name` | string | Display name |
| `icon` | string | URL — 140px icon |
| `icon_large` | string | URL — 720p icon |
| `description` | string | Short description |
| `conversion_type` | `"cpi"` \| `"cpe"` \| `"cpa"` \| `"cpl"` | Offer mechanic |
| `conversion_instructions_short` | string | One-liner for card UI |
| `conversion_instructions_long` | string | Full instructions for detail screen |
| `rules_requirements` | string | Eligibility warnings |
| `payout` | number | **Seeds** — already in configured currency, not USD |
| `payout_usd` | number | USD revenue value (for display) |
| `tracking_link` | string | Open in external browser on offer tap. Pass through unmodified. |
| `impression_url` | string | Fire as GET when offer card becomes visible. Do not modify. |
| `payment_required` | boolean | True = offer requires credit card / in-app purchase |
| `offer_complexity` | string | `"0"` = simple install/open, higher = multi-step |
| `platforms` | string[] | e.g. `["android"]` — already platform-matched by filter |
| `rating` | string | App store rating |
| `store_id` | string | App store identifier |
| `cpe_instructions` | AyetTask[] | CPE multi-task offers only — individual task list |
| `screenshots` | string[] | App store screenshots |
| `epc` | number | Earnings per click — quality signal |
| `conversion_time` | int | Expected seconds to complete |
| `max_conversion_time` | int | Hard deadline in seconds |

### CPE Task fields (`cpe_instructions[]`)

| Field | Type | Notes |
|---|---|---|
| `name` | string | Task display name |
| `uuid` | string | Stable task ID — use for deduplication |
| `payout` | number | Seeds for this task |
| `type` | string | `"main"` or `"bonus"` |
| `bonus_task` | boolean | Deprecated alias for `type === "bonus"` |
| `status` | string | `"new"` \| `"started"` \| `"in_progress"` \| `"unavailable"` |

---

## Server-Side Filters

Applied in order. All logic is server-side — client receives only the passing offers.

### 1. Platform filter
Offers with a non-empty `platforms` array are checked against `device_os`. If `device_os` is not in the array, the offer is removed.

### 2. Competitor keyword block
Offer `name` and `landing_page` are checked (case-insensitive) against `offerwall_blocked_keywords` from `app_config`. Default keywords:
```json
["freecash", "swagbucks", "mistplay", "cashyy", "rewarded play", "justplay", "buff"]
```

### 3. Pre-KYC restrictions
Applied when `user_tier = "new"` (user's `level` < `offerwall_verified_level_threshold`):
- Offers with `payout > offerwall_prekyc_max_payout` are removed
- Offers with `payment_required = true` are removed (unless `offerwall_prekyc_allow_payment_required = true`)

---

## User Tier

Determined by querying `public.users.level` for the authenticated user.

| Level | Tier | Effect |
|---|---|---|
| < `offerwall_verified_level_threshold` (default: 2) | `"new"` | Pre-KYC restrictions apply |
| >= threshold | `"verified"` | Sees all offers |

In dev mode, tier is always `"new"`.

> **TODO:** Replace level proxy with explicit `kyc_verified` boolean when KYC is implemented.

---

## Database

### `public.offerwall_requests` — written by this function

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK, auto-generated |
| `user_id` | UUID | FK → `auth.users(id)` ON DELETE SET NULL. NULL in dev mode. |
| `requested_at` | TIMESTAMPTZ | Auto set to `now()` |
| `device_os` | TEXT | `"android"` or `"ios"` |
| `country` | TEXT | ISO-2, nullable |
| `offer_count_raw` | INT | Offers from AyeT before filtering |
| `offer_count_filtered` | INT | Offers returned to client |
| `response_time_ms` | INT | Total function execution time |
| `error_message` | TEXT | Set on partial failures; NULL on success |

RLS is enabled with no policies — accessible via service role only.

### `public.app_config` — filter configuration

| `config_key` | `config_value` type | Default | Description |
|---|---|---|---|
| `offerwall_blocked_keywords` | JSON array | See above | Competitor keywords |
| `offerwall_prekyc_max_payout` | integer (seeds) | `5000` | Max payout for pre-KYC users |
| `offerwall_prekyc_allow_payment_required` | `"true"` / `"false"` | `"false"` | Show payment offers to pre-KYC users |
| `offerwall_verified_level_threshold` | integer | `2` | Min level for verified tier |

To update a filter value without redeploying:
```sql
UPDATE public.app_config
SET config_value = '["freecash","swagbucks","mistplay"]'
WHERE config_key = 'offerwall_blocked_keywords';
```

> **Note:** Filter config is loaded once per Edge Function isolate lifetime (warm in-memory cache). After updating `app_config`, the change takes effect on the next cold start (typically within a few minutes).

---

## Filter Debug (Dev Mode Only)

When called with `X-Test-Key`, `meta.filter_debug` is included in the response:

```json
"filter_debug": {
  "user_tier": "new",
  "filter_config": {
    "blocked_keywords": ["freecash", ...],
    "prekyc_max_payout": 5000,
    "prekyc_allow_payment_required": false,
    "verified_level_threshold": 2
  },
  "rejected": [
    {
      "id": 12345,
      "name": "Some Game",
      "reason": "platform",
      "detail": "offer platforms [ios] does not include \"android\""
    }
  ]
}
```

Rejection `reason` values: `platform` · `competitor_keyword` · `prekyc_payout` · `prekyc_payment_required`

This field is **never present in production responses**.

---

## Environment Secrets

| Secret | Required | Notes |
|---|---|---|
| `AYET_ADSLOT_ID` | ✅ | AyeT adslot identifier |
| `AYET_PLACEMENT_ID` | ✅ | AyeT placement identifier |
| `AYET_PUBLISHER_API_KEY` | ✅ | AyeT publisher API key |
| `DEV_TEST_KEY` | Dev only | Enables `X-Test-Key` bypass. Unset in production. |
| `SUPABASE_URL` | Auto-injected | Injected by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected | Injected by Supabase |
