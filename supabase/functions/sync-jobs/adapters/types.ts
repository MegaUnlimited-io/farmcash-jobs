// PartnerAdapter interface and CanonicalOffer type.
// Every partner maps its API response to CanonicalOffer before writing to DB.

export interface CanonicalOffer {
  partner_id: string;
  partner_offer_id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  conversion_type: "cpi" | "cpa" | "cpe" | "cpl" | null;
  payout_amount: number | null;
  seeds_amount: number | null;
  app_package_id: string | null;
  screenshots: string[] | null;
  cpe_tasks: CanonicalCpeTask[] | null;
  tracking_link_template: string | null;
}

export interface CanonicalCpeTask {
  id: string;          // partner's task UUID / stable ID
  name: string;
  event_name: string;
  payout_usd: number;
  currency_amount: number;
  status: string;
  type?: string;       // 'main' | 'bonus'
}

export interface PartnerAdapter {
  partner_id: string;
  fetchOffers(): Promise<CanonicalOffer[]>;
}
