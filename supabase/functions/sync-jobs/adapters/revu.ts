// Revu partner adapter — stub only, not wired into the orchestrator yet.
// Implement once Revu API docs are confirmed.

import type { PartnerAdapter, CanonicalOffer } from "./types.ts";

export function createRevuAdapter(): PartnerAdapter {
  return {
    partner_id: "revu",

    async fetchOffers(): Promise<CanonicalOffer[]> {
      throw new Error("Revu adapter not yet implemented");
    },
  };
}
