# All Offers API

## [Overview](https://revu.co/docs/all-offers-api#overview)

The Offers API provides publishers with access to available advertising campaigns (offers) tailored to their account status, target device, and promotion methods. Each offer includes comprehensive details about payouts, requirements, targeting restrictions, and multi-tier reward structures.

## [Quick Start](https://revu.co/docs/all-offers-api#quick-start)

Get your first offers in 30 seconds:

curl "https://publishers.revenueuniverse.com/affiliates/api.php?wall=YOUR\_WALL\_ID\&key=YOUR\_API\_KEY\&action=offers\&version=4"

## [Authentication](https://revu.co/docs/all-offers-api#authentication)

All requests require your API key. Include it in the key parameter of every request.

**Important**

Keep your API key secure \- never expose it in client-side code or public repositories.

To find your API Key, log into your Publisher Account, go to My Account \-\> API Key

## [Base URL](https://revu.co/docs/all-offers-api#base-url)

https://publishers.revenueuniverse.com/affiliates/api.php

## [Request Parameters](https://revu.co/docs/all-offers-api#request-parameters)

| Parameter | Type | Required | Description |
| ----- | ----- | ----- | ----- |
| wall | integer | ✅ | Your offer wall ID |
| key | string | ✅ | Your API authentication key |
| action | string | ✅ | Must be set to offers |
| version | integer | ✅ | Use 4 for latest version with additional offer details and multi-reward support (recommended) |
| offer | integer | ❌ | Get a specific offer by campaign ID |

## [Response Format](https://revu.co/docs/all-offers-api#response-format)

### [Success Response](https://revu.co/docs/all-offers-api#success-response)

{

  "status": "success",

  "affiliate\_id": 1234,

  "wall\_id": 123,

  "offers": \[

    {

      "cid": 46713,

      "name": "TikTok \- Install and Watch 1 Videos",

      "headline": "Install & Watch 1 Video on TikTok\!",

      "description": "TikTok is THE destination for mobile videos...",

      "requirements": "Install TikTok app and watch at least 1 videos to get rewarded\!",

      "extra\_terms": "You must hit \\"Allow\\" when the app asks to track...",

      "category": "Mobile Apps",

      "reporting": "Hourly",

      "rate": 2,

      "currency": 200,

      "offer\_type": 8,

      "url": "https://publishers.revenueuniverse.com/click.php?affiliate=1234\&campaign=12345...",

      "platform": "iOS",

      "countries": \["US"\],

      "cap": {

        "type": "Daily (GMT)",

        "position": "0",

        "maximum": "100"

      },

      "conversion\_rate": 0.2,

      "epc": 0.06

    }

  \]

}

### [Error Response](https://revu.co/docs/all-offers-api#error-response)

{

  "error": "No eligible promo types found. You may need to specify an offer wall."

}

## [Offer Object Reference](https://revu.co/docs/all-offers-api#offer-object-reference)

### [Basic Properties](https://revu.co/docs/all-offers-api#basic-properties)

| Field | Type | Description |
| ----- | ----- | ----- |
| cid | integer | Unique campaign identifier |
| name | string | Campaign name |
| headline | string | Offer headline (short description) |
| description | string | Detailed offer description |
| requirements | string | What users need to do to earn rewards |
| extra\_terms | string | Additional terms and conditions |
| category | string | Offer category (e.g., "Mobile Apps", "Purchase") |
| offer\_type | integer | Type of product promoted in offer, see mapping below |

### [Offer Type Mapping](https://revu.co/docs/all-offers-api#offer-type-mapping)

| ID | Category |
| ----- | ----- |
| 0 | Undefined |
| 1 | Casino/Gambling |
| 2 | Loyalty Offers |
| 3 | Non Branded Submits |
| 4 | Games |
| 5 | Trial/Purchase |
| 6 | Surveys |
| 7 | Branded |
| 8 | Mobile \- Non Gaming |
| 9 | Alcohol/Tobacco/Drugs |
| 10 | Other Mature |
| 11 | Social Casinos |

### [Financial & Performance Information](https://revu.co/docs/all-offers-api#financial-performance-information)

| Field | Type | Description |
| ----- | ----- | ----- |
| rate | float | Your payout in USD |
| currency | integer | Virtual currency awarded to users |
| epc | float | Historical earnings per click (network-wide, last 7 days) |
| conversion\_rate | float | Historical conversion rate (network-wide, last 7 days) |

### [Targeting & Restrictions](https://revu.co/docs/all-offers-api#targeting-restrictions)

| Field | Type | Description |
| ----- | ----- | ----- |
| platform | string | Target platform: "iOS", "Android", or "All" |
| countries | array | Allowed country codes (ISO 2-letter) |
| states | array | Allowed states/provinces (\["\*"\] \= all allowed) |
| user\_level | integer | Minimum user level required (0 \= no restriction, do not serve offers \> 0 without confirmation of eligibility from User-Level API) |
| min\_os\_version | integer | Minimum OS version (null \= no restriction) |

### [Capping & Reporting Time](https://revu.co/docs/all-offers-api#capping-reporting-time)

| Field | Type | Description |
| ----- | ----- | ----- |
| cap | object | Budget restrictions |
| cap.type | string | Cap period: "Daily (GMT)", "Monthly", etc. |
| cap.maximum | string | Maximum conversions allowed |
| cap.position | string | Current usage count |
| reporting | string | Expected tracking delay: "Instant", "Hourly", "2-3 Days" |

### [Image Assets](https://revu.co/docs/all-offers-api#image-assets)

| Field | Type | Description |
| ----- | ----- | ----- |
| creatives | array | Available images/banners |
| creatives\[\].width | integer | Image width in pixels |
| creatives\[\].height | integer | Image height in pixels |
| creatives\[\].image | string | Direct image URL |

### [URLs](https://revu.co/docs/all-offers-api#urls)

| Field | Type | Description |
| ----- | ----- | ----- |
| url | string | Click tracking URL (append UID after sid2= before use) |
| preview\_url | string | Landing page preview without tracking |
| app\_store\_id | string | App Store ID or Android package name |

## [Multi-Reward Offers (Tiers)](https://revu.co/docs/all-offers-api#multi-reward-offers-\(tiers\))

Versions 2 and above support offers with multiple reward tiers. These appear when tiers: true:

{

  "cid": 48323,

  "name": "Vegas Casino & Slots \- Multi \- 30 days",

  "tiers": true,

  "tiers\_list": \[

    {

      "requirements": "Install the app",

      "currency": 20,

      "rate": 0.01,

      "sid4": ""

    },

    {

      "requirements": "Complete Level 6",

      "currency": 20,

      "rate": 0.01,

      "sid4": "5levelup\_slots"

    },

    {

      "requirements": "Complete Level 11",

      "currency": 220,

      "rate": 0.11,

      "sid4": "10levelup\_slots"

    }

  \],

  "currency\_with\_tiers": 125240

}

### [Tier Properties](https://revu.co/docs/all-offers-api#tier-properties)

| Field | Type | Description |
| ----- | ----- | ----- |
| requirements | string | What the user must complete for this tier |
| currency | integer | Virtual currency for this specific tier |
| rate | float | Your payout for this tier in USD |
| sid4 | string | Tier identifier for tracking (can be empty) |

### [Working with Multi-Reward Offers](https://revu.co/docs/all-offers-api#working-with-multi-reward-offers)

* currency\_with\_tiers: Sum of all possible currency rewards  
* sid4: Use this identifier in postback tracking by adding $sid4$ to your postback template  
* Empty sid4 values are valid and represent completion events

## [Multi-Reward Event Tracking](https://revu.co/docs/all-offers-api#multi-reward-event-tracking)

User progression through Multi-Reward campaigns can be tracked by (1) using postbacks from RevU or (2) by calling the [User Level Offer API](https://revu.co/docs/user-level-offer-api). 

**Use Cases:**

* **Progress Visualization**: Display completion indicators for partially completed multi-reward offers  
* **Offer Filtering**: Hide completed tiers while maintaining visibility of available progression opportunities  
* **User Experience Optimization**: Provide contextual information about user progress and remaining earning potential

### [Option 1: Implementing Tier-Specific Tracking with Postbacks](https://revu.co/docs/all-offers-api#option-1-implementing-tier-specific-tracking-with-postbacks)

To enable precise tracking of multi-reward offer completions, incorporate the $sid4$ parameter into your postback URL template. This parameter will be dynamically populated with the tier-specific event identifier that corresponds to the sid4 value returned in the Offers API response.

**Postback Template Example:**

https://your-domain.com/postback?user\_id=$uid$\&campaign\_id=$campaign$\&tier=$sid4$\&payout=$rate$

#### [Event Identifier Specifications](https://revu.co/docs/all-offers-api#event-identifier-specifications)

**Direct Correlation**: The $sid4$ placeholder receives the exact sid4 value from the API response, enabling accurate attribution of tier-specific conversions within multi-reward campaigns.

**Empty Value Handling**: The sid4 parameter may contain an empty string, which constitutes a valid event identifier. Your postback processing logic must recognize empty sid4 values as legitimate tier completion events, not as data omissions or system errors.

**Uniqueness Constraints**: The sid4 value maintains uniqueness only within the scope of its associated campaign. To ensure system-wide uniqueness, combine the sid4 value with the $campaign$ identifier in your tracking implementation to prevent identifier conflicts across different campaigns.

#### [Single-Reward Offer Considerations](https://revu.co/docs/all-offers-api#single-reward-offer-considerations)

Standard offers with tiers: false do not include sid4 values in their API response structure. However, when the $sid4$ placeholder is present in your postback template, the system may still populate this parameter for single-reward offers. In such scenarios:

* **Disregard the** sid4 **value** for offers where tiers: false  
* **Interpret any postback** as confirmation of complete offer fulfillment  
* **Remove the completed offer** from the user's available offer inventory

### [Option 2: User Level Offer API to Check Progression](https://revu.co/docs/all-offers-api#option-2-user-level-offer-api-to-check-progression)

The [User Level Offer API](https://revu.co/docs/user-level-offer-api) provides comprehensive tracking capabilities for monitoring user progress across individual tiers within multi-reward offers. Implement API calls that include the user identifier (UID) to retrieve current completion status for all campaign tiers.

#### [Implementation Process](https://revu.co/docs/all-offers-api#implementation-process)

* **API Call**: Execute a request to the User Level Offer API  with the required UID parameter, append User-IP and Device if called server-side  
* **Response Processing**: Locate the campaign-specific tiers\_url endpoint within the API response  
* **Status Retrieval**: Query the tiers\_url to obtain real-time completion status for each available tier

The tiers\_url endpoint delivers current progress data, enabling dynamic user interface updates and accurate offer presentation based on individual user advancement within multi-reward campaigns.

## [Additional Information & Usage Recommendations](https://revu.co/docs/all-offers-api#additional-information-usage-recommendations)

### [Common Error Codes](https://revu.co/docs/all-offers-api#common-error-codes)

| Status | Message | Solution |
| ----- | ----- | ----- |
| 400 | "Invalid offer wall." | Check your wall ID parameter |
| 400 | "This API is incompatible with your affiliate account status." | Contact support to verify account status |
| 400 | "No eligible promo types found." | Specify a valid offer wall or check targeting settings |
| 500 | "Internal server error." | Retry request or contact support if persistent |

### [Example Requests](https://revu.co/docs/all-offers-api#example-requests)

### [Get All Offers](https://revu.co/docs/all-offers-api#get-all-offers)

curl "https://publishers.revenueuniverse.com/affiliates/api.php?wall=YOUR\_WALL\_ID\&key=YOUR\_API\_KEY\&action=offers\&version=4

### [Get Specific Offer](https://revu.co/docs/all-offers-api#get-specific-offer)

curl "https://publishers.revenueuniverse.com/affiliates/api.php?wall=YOUR\_WALL\_ID\&offer=OFFER\_ID\&key=YOUR\_API\_KEY\&action=offers\&version=4"

### [Filter by Platform](https://revu.co/docs/all-offers-api#filter-by-platform)

// After receiving the API response

const iosOffers \= offers.filter(offer \=\> 

  offer.platform \=== 'iOS' || offer.platform \=== 'All'

);

const androidOffers \= offers.filter(offer \=\> 

  offer.platform \=== 'Android' || offer.platform \=== 'All'

);

### [Integration Tips](https://revu.co/docs/all-offers-api#integration-tips)

### [Click URL Modification](https://revu.co/docs/all-offers-api#click-url-modification)

The url field contains a template that needs modification before serving to users \- append the userId after sid2= without modifying the rest of the URL:

// Example: Replace tracking parameters

let clickUrl \= offer.url;

clickUrl \= clickUrl.replace('\&sid2=', '\&sid2=USER\_ID\_HERE');

### [Cap Management](https://revu.co/docs/all-offers-api#cap-management)

Check the cap object to avoid showing exhausted offers:

const availableOffers \= offers.filter(offer \=\> {

  if (\!offer.cap) return true; // No cap restrictions


  const position \= parseInt(offer.cap.position);

  const maximum \= parseInt(offer.cap.maximum);


  return position \< maximum;

});

### [Multi-Reward Tracking](https://revu.co/docs/all-offers-api#multi-reward-tracking)

For offers with tiers: true, implement progress tracking:

if (offer.tiers) {

  // Show tier progression UI

  offer.tiers\_list.forEach(tier \=\> {

    console.log(\`Tier: ${tier.requirements} → ${tier.currency} coins\`);

  });


  // Total possible reward

  console.log(\`Max reward: ${offer.currency\_with\_tiers} coins\`);

}

## [Rate Limiting](https://revu.co/docs/all-offers-api#rate-limiting)

* API calls are monitored for abuse  
* Recommended: Cache responses for 2-10 minutes  
* Excessive requests (\>5 per minute) may result in temporary blocking

## [Support](https://revu.co/docs/all-offers-api#support)

For technical support or questions about specific offers, reach out to your account manager or sales contact.  
