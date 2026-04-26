import type { PartnerAdapter, CanonicalOffer, CanonicalCpeTask } from "./types.ts";

const BASE_URL = "https://www.ayetstudios.com";

// Raw shapes from the AyeT Static API (confirmed against live response 2026-04-26)
interface AyetCpeInstruction {
  uuid: string;
  name: string;
  event_name: string;
  payout: number;         // Seeds reward for this task
  payout_base: number;
  status: string;         // "available" | "completed"
  bonus_task: boolean;
  type?: string;          // "normal" | "bonus"
  currency?: string;
}

interface AyetTags {
  tab?: string;
  tasks?: string[];
  categories?: string[];
}

interface AyetOffer {
  id: number;
  store_id?: string;      // app bundle ID (e.g. com.foo.bar) — absent on web offers
  landing_page?: string;  // Play Store URL or web landing page
  icon: string;
  name: string;
  description: string;    // "Earn X Seeds by completing..." — not useful for wiki
  introduction?: string;  // Rich HTML about the app — use this for wiki description
  tags?: AyetTags;
  conversion_type: string;
  payout: number;         // Seeds total for this offer
  payout_base: number;
  currency_amount: number;
  screenshots: string[];
  tracking_link: string;
  daily_cap?: number;     // absent = no cap; 0 = cap exhausted (filter out)
  payment_required: boolean;
  cpe_instructions?: AyetCpeInstruction[];
}

interface AyetResponse {
  status: string;
  error?: string;
  offers?: AyetOffer[];
  num_offers?: number;
}

export function createAyetAdapter(): PartnerAdapter {
  const apiKey = Deno.env.get("AYET_STATIC_API_KEY");
  const adslotId = Deno.env.get("AYET_JOBS_ADSLOT_ID");

  if (!apiKey || !adslotId) {
    throw new Error("AYET_STATIC_API_KEY and AYET_JOBS_ADSLOT_ID must be set");
  }

  return {
    partner_id: "ayetstudios",

    async fetchOffers(): Promise<CanonicalOffer[]> {
      // Brackets must be unencoded — AyeT uses PHP array notation
      const url = `${BASE_URL}/offers/get/${adslotId}?apiKey=${apiKey}&platform[]=android`;
      const res = await fetch(url);

      if (!res.ok) throw new Error(`AyeT Static API HTTP ${res.status}`);

      const data: AyetResponse = await res.json();
      if (data.status !== "success") {
        throw new Error(`AyeT API error: ${data.error ?? "unknown"}`);
      }

      const offers = data.offers ?? [];
      console.log(`[ayetstudios] ${offers.length} offers before filtering`);

      // Filter: daily_cap === 0 means cap exhausted; payment_required = paid offers
      return offers
        .filter((o) => o.daily_cap !== 0 && !o.payment_required)
        .map(mapToCanonical);
    },
  };
}

function mapToCanonical(o: AyetOffer): CanonicalOffer {
  return {
    partner_id: "ayetstudios",
    partner_offer_id: String(o.id),
    name: o.name,
    description: stripHtml(o.introduction) || null,
    icon_url: o.icon || null,
    conversion_type: (o.conversion_type as CanonicalOffer["conversion_type"]) ?? null,
    payout_amount: o.payout ?? null,
    app_package_id: o.store_id || null,
    screenshots: o.screenshots?.length ? o.screenshots : null,
    cpe_tasks: mapCpeTasks(o.cpe_instructions),
    tracking_link_template: o.tracking_link || null,
    landing_page: o.landing_page || null,
    categories: o.tags?.categories ?? null,
  };
}

function mapCpeTasks(instructions: AyetCpeInstruction[] | undefined): CanonicalCpeTask[] | null {
  if (!instructions || instructions.length === 0) return null;
  return instructions.map((t) => ({
    id: t.uuid,
    name: t.name,
    event_name: t.event_name,
    payout_seeds: t.payout,
    status: t.status,
    bonus_task: t.bonus_task,
    type: t.type,
  }));
}

function stripHtml(html: string | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
