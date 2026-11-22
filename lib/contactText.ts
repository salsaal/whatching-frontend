// Plain words for contact fields the backend sends as codes.

/** Where a contact came from, when it was the store; null otherwise. */
export const storeOptInText = (optInSource?: string | null) => {
  if (optInSource === "store_checkout") return "Added from your store (order)";
  if (optInSource === "store_cart") return "Added from your store (checkout)";
  return null;
};

const PLAN_LIMIT_WAIT = "Waiting for room in your plan's contact limit.";

// Every reason the backend sets in broadcastEligibilityReason for a
// restricted contact. (recent_engagement is why one is included, so it
// isn't a restriction.)
const RESTRICTION_REASONS: Record<string, string> = {
  opted_out: "Opted out of marketing messages.",
  not_whatsapp_reachable: "Can't be reached on WhatsApp.",
  manual_exclusion: "You excluded this contact from broadcasts.",
  archived: "Archived.",
  plan_subscriber_capacity: PLAN_LIMIT_WAIT,
  plan_subscriber_limit: PLAN_LIMIT_WAIT,
  awaiting_plan_capacity: PLAN_LIMIT_WAIT,
  less_recent_than_plan_pool:
    "Over your plan's contact limit. Your most recently active contacts are kept first."
};

export const RESTRICTED_FALLBACK = "Currently restricted from broadcasts.";

/** Why a contact is kept out of broadcasts, in plain words. */
export const broadcastRestrictionText = (reason?: string | null) =>
  (reason && Object.hasOwn(RESTRICTION_REASONS, reason)
    ? RESTRICTION_REASONS[reason]
    : null) || RESTRICTED_FALLBACK;
