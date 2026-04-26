// PartnerAdapter interface and CanonicalOffer type.
// Every partner maps its API response to CanonicalOffer before writing to DB.
//
// payout_amount = Seeds total for this offer (all partners normalise to Seeds).
// Future USD-paying partners should add a separate usd_amount field.

export interface CanonicalOffer {
  partner_id: string;
  partner_offer_id: string;
  name: string;
  description: string | null;       // stripped HTML from introduction/about text
  icon_url: string | null;
  conversion_type: "cpi" | "cpa" | "cpe" | "cpl" | null;
  payout_amount: number | null;     // Seeds total
  app_package_id: string | null;    // bundle ID — null = web offer (no wiki page yet)
  screenshots: string[] | null;
  cpe_tasks: CanonicalCpeTask[] | null;
  tracking_link_template: string | null;
  landing_page: string | null;      // Play Store / web URL
  categories: string[] | null;      // from partner taxonomy (e.g. ["games_puzzle", "games"])
}

export interface CanonicalCpeTask {
  id: string;           // stable UUID from partner
  name: string;
  event_name: string;
  payout_seeds: number; // Seeds reward for this task (0 for install-tracking step)
  status: string;       // "available" | "completed"
  bonus_task: boolean;
  type?: string;        // "normal" | "bonus"
}

export interface PartnerAdapter {
  partner_id: string;
  fetchOffers(): Promise<CanonicalOffer[]>;
}
