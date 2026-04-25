# AyeT Studios API — FarmCash Reference Guide

> v1.14.14 | Last updated: 2026-01-30
> Base URL: `https://www.ayetstudios.com`
> This doc replaces the full OpenAPI spec for day-to-day dev use.

---

## 1. API Overview & FarmCash Recommendation

AyeT exposes four APIs that matter to us:

| API | Endpoint | Auth | Purpose |
|-----|----------|------|---------|
| **Offerwall API** | `GET /offers/offerwall_api/{adslot}` | None (public) | Fetch offers for a specific user, device-matched and geo-matched in real time |
| **Static API** | `GET /offers/get/{adslot}` | `apiKey` (Static key) | Fetch all eligible offers server-side without a specific user context. Server-side only, refresh every 15–30 min |
| **Reward Status API** | `GET /rest/v1/userSupport/get_reward_status` | None (placement + user ID) | Get a user's progress on all active CPE offers (task completion status, remaining payout, etc.) |
| **Reporting API** | `GET /api2/publisher/reporting` | `apiKey` (Publisher key) | Pull daily revenue, conversion, and impression stats by date range |

There are two other minor APIs: **Set Currency Conversion Rate** and **Get Ads.txt** — you won't need these in the MVP. There is also a **Surveywall API** (`/surveys/surveywall_api/{adslot}`) for survey offers — ignore for now, AyeT surveys skew low-payout and are a distraction from gaming offers.

### ✅ Recommendation: Use Offerwall API for FarmCash MVP

**Use the Offerwall API exclusively for the MVP.** Here's why:

- It's called client-side directly from the Flutter app, so you avoid server-side proxy complexity
- It automatically filters offers by the user's real device, OS, and geo — you get the right offers for each user without any filtering logic on your end
- It returns `payout_usd` and full CPE task breakdowns per offer, giving you everything needed to calculate seeds
- The `external_identifier` you pass becomes your user-to-conversion linkage — use the Supabase user UUID here
- Pass `gaid` (Google Advertising ID) when available — this significantly improves campaign matching and conversion tracking

The **Static API** is only useful if you want to build a custom offer-browsing UI seeded from a server-side cache (e.g., to pre-render offer listings without waiting on per-user API calls). Skip it for now — the Offerwall API handles everything.

The **Reward Status API** becomes important once you have CPE offers live — poll it to update task progress in your UI. Integrate it in the second sprint after core farming works.

---

## 2. Key Concepts

### Authentication
- **Offerwall API**: No API key needed in the request URL. Your `adslot` ID is your identifier.
- **Static API**: Uses a separate "Static API key" (different from your Publisher API key) — get it from the adslot settings in your dashboard.
- **Reporting API**: Uses your Publisher API key (`apiKey` query param).
- **Reward Status API**: No key — uses `placementId` + `externalIdentifier`.

### Your IDs (fill these in when live)
```
ADSLOT_ID        = <from dashboard: Placements → Edit Adslot>
PLACEMENT_ID     = <from dashboard>
PUBLISHER_API_KEY = <from Account Settings>
STATIC_API_KEY   = <from adslot details, after account manager approval>
```

### external_identifier
This is **your user ID** — use the Supabase user UUID. It's what ties AyeT conversion postbacks back to your users. It also appears in the Reward Status API. Keep it consistent — never change it for a given user.

### Seeds Calculation
AyeT pays you in USD. Your seed conversion formula:
```
seeds_awarded = payout_usd × seeds_per_dollar
```
Set `seeds_per_dollar` in your adslot currency config in the AyeT dashboard. Example: if 1000 seeds = $1, set conversion rate to 1000.

### Postback (Conversion Callback)
Configure this URL in your AyeT dashboard under Placements → Settings:
```
https://api.megaunlimited.io/ocg/postback?
  transaction_id={transaction_id}
  &user_id={external_identifier}
  &payout_usd={payout_usd}
  &offer_id={offer_id}
  &offer_name={offer_name}
  &is_chargeback={is_chargeback}
  &event_name={event_name}
  &task_uuid={task_uuid}
  &custom_1={custom_1}
```
Your OCG service must return HTTP 200. AyeT retries 12 times over 1 hour on failure.

**Whitelist these AyeT postback IPs in your firewall:**
```
51.79.101.241 | 158.69.185.134 | 158.69.185.154
35.165.166.40 | 35.166.159.131 | 52.40.3.140
```

---

## 3. Offerwall API — Full Reference

```
GET /offers/offerwall_api/{adslot}
```

### Required Parameters
| Param | Type | Notes |
|-------|------|-------|
| `external_identifier` | string | Your user UUID |

### Recommended Parameters (use all of these)
| Param | Type | Notes |
|-------|------|-------|
| `user_agent` | string | URL-encode the device's user agent |
| `client_hints` | string | JSON-encoded UA client hints (see Flutter section) |
| `gaid` | string | Google Advertising ID — improves matching significantly |
| `ip` | string | Required for server-side calls only; omit for client-side |

### Optional Parameters
| Param | Type | Notes |
|-------|------|-------|
| `os` | enum | `android`, `ios`, `desktop` |
| `os_version` | string | e.g. `14.0.0` |
| `device_make` | string | e.g. `Samsung` |
| `device_model` | string | e.g. `Galaxy S24` |
| `include_cpe` | bool | **Set `true`** — CPE offers are the highest payout type |
| `offer_sorting` | enum | `payout`, `conversion_rate`, `epc`, `ecpm` — recommend `ecpm` |
| `minimum_payout` | float | Minimum offer payout in USD. Suggest `0.05` to filter junk |
| `num_offers` | int | Limit returned offers. Omit to get all |
| `language` | string | ISO language code, e.g. `en` |
| `age` | int | User age in years (if collected) |
| `gender` | enum | `male`, `female`, `non_binary` (if collected) |
| `custom_1`–`custom_5` | string | Passed through to your postback — use `custom_1` for internal click tracking |

### Response Fields (per offer)
| Field | Type | Notes |
|-------|------|-------|
| `id` | int | AyeT offer ID |
| `name` | string | Display name |
| `icon` | string | URL to 140px icon |
| `icon_large` | string | Optional 720p icon |
| `video_url` | string | Optional 15s promo video (h264) |
| `description` | string | Short description |
| `conversion_type` | string | `cpi`, `cpa`, `cpe`, `cpl` |
| `conversion_instructions_short` | string | One-liner for UI |
| `conversion_instructions_long` | string | Full instructions |
| `introduction` | string | Intro text for offer detail screen |
| `rules_requirements` | string | Eligibility rules |
| `payout_usd` | float | **Your revenue in USD if completed** |
| `currency_amount` | int/float | Amount in your virtual currency (seeds) — set by your conversion rate |
| `epc` | float | Earnings per click — quality signal |
| `daily_cap` | int | Remaining conversions available today |
| `tracking_link` | string | Use this as the offer URL; append `&custom_1=YOUR_CLICK_ID` |
| `impression_url` | string | 1×1 GIF to fire when offer is shown (fires impression tracking) |
| `conversion_time` | int | Expected seconds to convert |
| `max_conversion_time` | int | Hard deadline in seconds |
| `offer_status_days_left` | int/null | Days left to complete if user started it |
| `tasks` | array | **CPE only** — list of sub-tasks with individual payouts |
| `kpi` | object | ROAS at d1/d7/d14/d30 — quality signals |
| `rating` | string/null | App store rating (1–5) |
| `screenshots` | array | App store screenshot URLs |
| `has_installation_callback` | bool | If true, install fires a callback too |
| `payment_required` | bool | True = offer requires payment — avoid these for now |
| `offer_complexity` | string | `0`=simple, higher = more complex |

### CPE Task Fields (inside `tasks[]`)
| Field | Notes |
|-------|-------|
| `name` | Display name of the task |
| `uuid` | Persistent task UUID — use for deduplication |
| `event_name` | Internal event name (matches postback `{event_name}`) |
| `payout` | USD payout for completing this task |
| `currency_amount` | Seeds for this task |
| `status` | `new`, `started`, `in_progress`, `unavailable` |
| `remaining_time` | Seconds remaining to complete |
| `type` | Task type — `main` or `bonus` (replaces deprecated `bonus_task`) |
| `conversion_limit` | Max times a user can complete |
| `single_conversion_per_day` | If true, 1 completion per day |

---

## 4. Static API — Quick Reference

```
GET /offers/get/{adslot}?apiKey=STATIC_KEY
```

Use this only if you cache offers server-side. Requires account manager approval for the Static API key.

| Param | Type | Notes |
|-------|------|-------|
| `apiKey` | string | Static API key (adslot-specific, not Publisher key) |
| `countries[]` | array | ISO2 codes, e.g. `countries[]=US&countries[]=GB` |
| `platform[]` | array | `android`, `ios`, `desktop` |
| `conversion_type[]` | array | `cpi`, `cpa`, `cpe`, `cpl` |

Response shape is identical to Offerwall API but `tracking_link` contains `{external_identifier}` as a placeholder — you must substitute the user's ID before showing the link.

**Call frequency: every 15–30 minutes max.** Not per-user.

---

## 5. Reward Status API — Quick Reference

```
GET /rest/v1/userSupport/get_reward_status?placementId={PLACEMENT_ID}&externalIdentifier={USER_UUID}
```

No API key required.

Returns all offers a user has clicked on, with per-task completion status. Use this to update task progress badges in the FarmCash offer detail screen.

### Key Response Fields
```json
{
  "user": { "country": "DE", "platform": "android", ... },
  "reward_status": {
    "{offer_id}": {
      "name": "Offer Name",
      "click_id": "...",
      "created": "2025-01-01 12:00:00",
      "expiration_time": 1234567890,
      "pub_payout": 2.50,
      "remaining_payout_usd": 1.80,
      "tasks": [
        {
          "name": "Reach Level 10",
          "uuid": "dff19bdd-...",
          "event_name": "level_10",
          "status": "completed",   // or "pending", "available"
          "pub_payout": 0.50,
          "num_conversions": 1,
          "total_reward_amount": 0.50,
          "rewarded_amount": 0.50
        }
      ]
    }
  }
}
```

---

## 6. Reporting API — Quick Reference

```
GET /api2/publisher/reporting?apiKey=PUBLISHER_KEY&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```

Rate limit: 20 calls/hour.

| Param | Required | Notes |
|-------|----------|-------|
| `apiKey` | ✅ | Publisher API key |
| `startDate` | ✅ | `YYYY-MM-DD` |
| `endDate` | ✅ | `YYYY-MM-DD` |
| `placements[]` | no | Filter by placement ID |
| `adslots[]` | no | Filter by adslot ID |
| `countries[]` | no | Filter by ISO2 country |
| `adformat[]` | no | e.g. `offerwall_api` |

Response is nested: `data → {date} → {placement_id} → adslots → {adslot_id} → statistics → {country} → {metrics}`

Key metrics: `impressions`, `clicks`, `conversions`, `revenue`, `EPC`, `eCPM`, `DAU`.

---

## 7. PowerShell Test Queries (Windows 11)

Replace `YOUR_ADSLOT_ID`, `YOUR_PLACEMENT_ID`, `YOUR_API_KEY` with your real values.

### 7a. Fetch Live Offers — Android, US, include CPE, sort by eCPM

```powershell
# Pretty-print with ConvertFrom-Json
$adslot = "YOUR_ADSLOT_ID"
$userId = "test-user-001"
$ua = [uri]::EscapeDataString("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36")

$url = "https://www.ayetstudios.com/offers/offerwall_api/$adslot" +
       "?external_identifier=$userId" +
       "&os=android" +
       "&os_version=14.0.0" +
       "&device_make=Google" +
       "&device_model=Pixel+8" +
       "&include_cpe=true" +
       "&offer_sorting=ecpm" +
       "&minimum_payout=0.05" +
       "&language=en" +
       "&user_agent=$ua"

$response = Invoke-RestMethod -Uri $url -Method Get
$response | ConvertTo-Json -Depth 10 | Out-File "offers_us_android.json"
Write-Host "Total offers returned: $($response.num_offers)"
```

### 7b. Inspect a Single Offer — Name, Payout, and CPE Tasks

```powershell
# Run this after 7a — reads the saved file and shows offer detail
$data = Get-Content "offers_us_android.json" | ConvertFrom-Json

# Show top 5 offers with payout
$data.offerwall.offers | Select-Object -First 5 | ForEach-Object {
    Write-Host "---"
    Write-Host "ID:          $($_.id)"
    Write-Host "Name:        $($_.name)"
    Write-Host "Type:        $($_.conversion_type)"
    Write-Host "Payout USD:  $($_.payout_usd)"
    Write-Host "Seeds:       $($_.currency_amount)"
    Write-Host "EPC:         $($_.epc)"
    Write-Host "Complexity:  $($_.offer_complexity)"
    if ($_.tasks) {
        Write-Host "CPE Tasks:"
        $_.tasks | ForEach-Object {
            Write-Host "  - $($_.name): `$$($_.payout) | Status: $($_.status)"
        }
    }
}
```

### 7c. Fetch a Specific Offer's Task Detail (Reward Status)

```powershell
$placementId = "YOUR_PLACEMENT_ID"
$userId = "test-user-001"

$url = "https://www.ayetstudios.com/rest/v1/userSupport/get_reward_status" +
       "?placementId=$placementId" +
       "&externalIdentifier=$userId"

$response = Invoke-RestMethod -Uri $url -Method Get
$response | ConvertTo-Json -Depth 10
```

### 7d. Pull Yesterday's Revenue Report

```powershell
$apiKey = "YOUR_PUBLISHER_API_KEY"
$yesterday = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
$today = (Get-Date).ToString("yyyy-MM-dd")

$url = "https://www.ayetstudios.com/api2/publisher/reporting" +
       "?apiKey=$apiKey" +
       "&startDate=$yesterday" +
       "&endDate=$today"

$response = Invoke-RestMethod -Uri $url -Method Get
$response | ConvertTo-Json -Depth 10
```

### 7e. Quick cURL Equivalent (if you prefer curl.exe)

```powershell
# Windows 11 ships with curl.exe natively
$adslot = "YOUR_ADSLOT_ID"
curl.exe -s "https://www.ayetstudios.com/offers/offerwall_api/$adslot?external_identifier=test-user-001&os=android&os_version=14.0.0&include_cpe=true&offer_sorting=ecpm" | python.exe -m json.tool
```

> **Note:** If Python isn't available for pretty-printing, pipe to `| ConvertFrom-Json | ConvertTo-Json -Depth 10` in PowerShell instead.

---

## 8. Flutter Integration (Android First)

### 8a. Dependencies

```yaml
# pubspec.yaml
dependencies:
  http: ^1.2.0
  device_info_plus: ^10.0.0   # for device make/model/OS
  advertising_id: ^2.0.0      # for GAID
```

### 8b. AyeT Service Class

```dart
// lib/services/ayet_service.dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:device_info_plus/device_info_plus.dart';
import 'package:advertising_id/advertising_id.dart';

class AyetService {
  static const String _baseUrl = 'https://www.ayetstudios.com';
  static const String _adslotId = 'YOUR_ADSLOT_ID'; // from dashboard

  /// Fetch offers for the current user.
  /// [userId] = Supabase user UUID
  static Future<List<AyetOffer>> fetchOffers(String userId) async {
    final deviceInfo = DeviceInfoPlugin();
    final androidInfo = await deviceInfo.androidInfo;

    String? gaid;
    try {
      gaid = await AdvertisingId.id(true);
    } catch (_) {
      // GAID not available (user opted out or emulator)
    }

    final params = {
      'external_identifier': userId,
      'os': 'android',
      'os_version': androidInfo.version.release,
      'device_make': androidInfo.manufacturer,
      'device_model': androidInfo.model,
      'include_cpe': 'true',
      'offer_sorting': 'ecpm',
      'minimum_payout': '0.05',
      'language': 'en',
      if (gaid != null) 'gaid': gaid,
    };

    final uri = Uri.parse('$_baseUrl/offers/offerwall_api/$_adslotId')
        .replace(queryParameters: params);

    final response = await http.get(uri).timeout(const Duration(seconds: 10));

    if (response.statusCode != 200) {
      throw Exception('AyeT API error: ${response.statusCode}');
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;

    if (data['status'] != 'success') {
      throw Exception('AyeT returned error: ${data['error']}');
    }

    final offersRaw = data['offerwall']?['offers'] as List<dynamic>? ?? [];
    return offersRaw.map((o) => AyetOffer.fromJson(o)).toList();
  }

  /// Get reward status for a user (CPE task progress).
  static Future<Map<String, dynamic>> getRewardStatus(String userId) async {
    const placementId = 'YOUR_PLACEMENT_ID';
    final uri = Uri.parse(
      '$_baseUrl/rest/v1/userSupport/get_reward_status'
      '?placementId=$placementId&externalIdentifier=$userId',
    );

    final response = await http.get(uri).timeout(const Duration(seconds: 10));
    if (response.statusCode != 200) throw Exception('Reward status error');
    return jsonDecode(response.body) as Map<String, dynamic>;
  }
}
```

### 8c. Offer Model

```dart
// lib/models/ayet_offer.dart
class AyetOffer {
  final int id;
  final String name;
  final String icon;
  final String conversionType;   // cpi, cpa, cpe, cpl
  final double payoutUsd;        // YOUR revenue
  final double currencyAmount;   // seeds to award user
  final double epc;
  final String conversionInstructionsShort;
  final String trackingLink;
  final String? videoUrl;
  final List<AyetTask> tasks;    // CPE sub-tasks

  AyetOffer.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        name = j['name'],
        icon = j['icon'],
        conversionType = j['conversion_type'],
        payoutUsd = (j['payout_usd'] as num).toDouble(),
        currencyAmount = (j['currency_amount'] as num).toDouble(),
        epc = (j['epc'] as num? ?? 0).toDouble(),
        conversionInstructionsShort = j['conversion_instructions_short'] ?? '',
        trackingLink = j['tracking_link'] ?? '',
        videoUrl = j['video_url']?.isNotEmpty == true ? j['video_url'] : null,
        tasks = (j['tasks'] as List<dynamic>? ?? [])
            .map((t) => AyetTask.fromJson(t))
            .toList();

  /// Seeds the user earns. For CPE, sum of all task seeds.
  double get seedsForUser {
    if (tasks.isNotEmpty) {
      return tasks.fold(0.0, (sum, t) => sum + t.currencyAmount);
    }
    return currencyAmount;
  }
}

class AyetTask {
  final String name;
  final String uuid;
  final String eventName;
  final double payoutUsd;
  final double currencyAmount;
  final String status; // new, started, in_progress, unavailable

  AyetTask.fromJson(Map<String, dynamic> j)
      : name = j['name'],
        uuid = j['uuid'] ?? '',
        eventName = j['event_name'] ?? '',
        payoutUsd = (j['payout'] as num).toDouble(),
        currencyAmount = (j['currency_amount'] as num? ?? 0).toDouble(),
        status = j['status'] ?? 'new';
}
```

### 8d. Firing the Tracking Link

When a user taps an offer, open the `tracking_link` in an in-app browser or external browser. Substitute `{external_identifier}` before launching:

```dart
import 'package:url_launcher/url_launcher.dart';

void openOffer(AyetOffer offer, String userId) {
  final link = offer.trackingLink.replaceAll('{external_identifier}', userId);
  launchUrl(Uri.parse(link), mode: LaunchMode.externalApplication);
}
```

> **Always use `LaunchMode.externalApplication`** so the actual app install / game session is tracked correctly. In-app WebView breaks attribution for most CPI/CPE offers.

### 8e. Impression Tracking

When an offer card scrolls into view, fire the impression URL (1×1 GIF):

```dart
void trackImpression(AyetOffer offer, String userId) {
  if (offer.impressionUrl.isEmpty) return;
  final url = offer.impressionUrl.replaceAll('{external_identifier}', userId);
  http.get(Uri.parse(url)).ignore(); // fire and forget
}
```

---

## 9. Postback / OCG Integration Notes

Your OCG Edge Function at `api.megaunlimited.io/ocg/postback` needs to handle:

| Scenario | `is_chargeback` | Action |
|----------|-----------------|--------|
| Normal conversion | `0` | Credit seeds to user's pending balance |
| Chargeback | `1` | Deduct seeds (check `chargeback_reason`) |
| CPE task completion | `0` + `event_name` set | Credit partial seeds per task |

Use `transaction_id` for deduplication — store in a conversions table and reject duplicates.

**Conditional postback syntax** (configure in AyeT dashboard) for routing installs vs events:
```
is_install={%event_name==INSTALLATION_TRACKED?1:0%}
```

---

## 10. Rate Limits & Gotchas

- **Offerwall API**: No documented rate limit for normal use. Don't hammer it — cache responses for 60s minimum per user.
- **Reporting API**: 20 calls/hour. Call once per hour from a cron job; don't call on-demand.
- **Set Conversion Rate API**: 60 calls/hour. Set once during setup, not dynamically.
- **AyeT retries postbacks 12x** over 1 hour — your OCG endpoint must be idempotent.
- Pass `include_cpe=true` — CPE offers are higher payout and not included by default.
- `payment_required: true` offers require the user to spend money in-app — these convert poorly for our audience. Consider filtering them out initially.
- `offer_complexity` field: `0` = simple (install, open). Higher values = multi-step. For pre-KYC users, only show complexity `0`.
- The `daily_cap` field tells you remaining conversions today. If `0`, skip showing the offer.
