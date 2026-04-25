import type { PartnerAdapter, CanonicalOffer, CanonicalCpeTask } from "./types.ts";

const BASE_URL = "https://www.ayetstudios.com";

// Raw shapes returned by the AyeT API
interface AyetTask {
  uuid: string;
  name: string;
  event_name: string;
  payout: number;
  currency_amount: number;
  status: string;
  type?: string;
}

interface AyetOffer {
  id: number;
  name: string;
  icon: string;
  description: string;
  conversion_type: string;
  payout_usd: number;
  currency_amount: number;
  screenshots: string[];
  tracking_link: string;
  daily_cap: number;
  payment_required: boolean;
  tasks?: AyetTask[];
}

interface AyetResponse {
  status: string;
  error?: string;
  // Static API: offers at top level
  offers?: AyetOffer[];
  num_offers?: number;
  // Offerwall API: offers nested (kept for reference, not used here)
  offerwall?: {
    offers: AyetOffer[];
    num_offers: number;
  };
}

export function createAyetAdapter(): PartnerAdapter {
  // Static API key — adslot-specific, separate from the Publisher API key.
  // Get it from AyeT dashboard → Placements → Edit Adslot → Static API Key.
  // Requires account manager approval if not yet visible.
  const apiKey = Deno.env.get("AYET_STATIC_API_KEY");
  const adslotId = Deno.env.get("AYET_JOBS_ADSLOT_ID");

  if (!apiKey || !adslotId) {
    throw new Error("AYET_STATIC_API_KEY and AYET_JOBS_ADSLOT_ID must be set");
  }

  return {
    partner_id: "ayetstudios",

    async fetchOffers(): Promise<CanonicalOffer[]> {
      // Brackets must be unencoded — AyeT uses PHP array notation
      const url =
        `${BASE_URL}/offers/get/${adslotId}?apiKey=${apiKey}&platform[]=android`;

      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`AyeT Static API HTTP ${res.status}`);
      }

      const data: AyetResponse = await res.json();

      if (data.status !== "success") {
        throw new Error(`AyeT API error: ${data.error ?? "unknown"}`);
      }

      // Static API returns offers at top level; Offerwall API nests under .offerwall
      const offers = data.offers ?? data.offerwall?.offers ?? [];
      console.log(`[ayetstudios] ${offers.length} offers before filtering (num_offers=${data.num_offers})`);

      // Filter out: offers with no remaining daily cap, and payment-required offers
      return offers
        .filter((o) => o.daily_cap !== 0 && !o.payment_required)
        .map(mapToCanonical);
    },
  };
}

function mapToCanonical(o: AyetOffer): CanonicalOffer {
  const cpeTasks: CanonicalCpeTask[] | null =
    o.tasks && o.tasks.length > 0
      ? o.tasks.map((t) => ({
          id: t.uuid,
          name: t.name,
          event_name: t.event_name,
          payout_usd: t.payout,
          currency_amount: t.currency_amount,
          status: t.status,
          type: t.type,
        }))
      : null;

  return {
    partner_id: "ayetstudios",
    partner_offer_id: String(o.id),
    name: o.name,
    description: o.description || null,
    icon_url: o.icon || null,
    conversion_type: (o.conversion_type as CanonicalOffer["conversion_type"]) ??
      null,
    payout_amount: o.payout_usd ?? null,
    seeds_amount: o.currency_amount ?? null,
    app_package_id: null, // Not in AyeT response; enrichment pipeline fills this
    screenshots: o.screenshots?.length ? o.screenshots : null,
    cpe_tasks: cpeTasks,
    tracking_link_template: o.tracking_link || null,
  };
}
