// Plain words for contact fields the backend sends as codes.

/** Where a contact came from, when it was the store; null otherwise. */
export const storeOptInText = (optInSource?: string | null) => {
  if (optInSource === "store_checkout") return "Added from your store (order)";
  if (optInSource === "store_cart") return "Added from your store (checkout)";
  return null;
};

const RESTRICTION_REASONS: Record<string, string> = {
  awaiting_plan_capacity: "Waiting for room in your plan's contact limit"
};

/**
 * Why a contact is kept out of broadcasts automatically, in plain words;
 * null for codes without wording (they aren't shown).
 */
export const broadcastRestrictionText = (reason?: string | null) =>
  (reason && RESTRICTION_REASONS[reason]) || null;
