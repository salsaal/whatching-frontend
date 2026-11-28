// Plain words for contact fields the backend sends as codes.

import { formatCount } from "@/lib/displayFormat";

/** Where a contact came from, when it was the store; null otherwise. */
export const storeOptInText = (optInSource?: string | null) => {
  if (optInSource === "store_checkout") return "Added from your store (order)";
  if (optInSource === "store_cart") return "Added from your store (checkout)";
  return null;
};

// The plan's number is the size of the broadcast list (the contacts that
// broadcasts and drips go to), not a cap on contacts.
const PLAN_LIMIT_WAIT = "Waiting for a place on your broadcast list.";

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
    "Not on your broadcast list. The list is full, and your most recently active contacts come first."
};

export const RESTRICTED_FALLBACK = "Currently restricted from broadcasts.";

/** Why a contact is kept out of broadcasts, in plain words. */
export const broadcastRestrictionText = (reason?: string | null) =>
  (reason && Object.hasOwn(RESTRICTION_REASONS, reason)
    ? RESTRICTION_REASONS[reason]
    : null) || RESTRICTED_FALLBACK;

/**
 * The import preview's note when the file takes the workspace past its
 * broadcast list size; null otherwise. Not an error: the import still runs.
 */
export const importBroadcastListNote = (summary?: {
  contactsAfterImport?: number;
  subscriberLimit?: number | null;
}) => {
  const after = summary?.contactsAfterImport;
  const limit = summary?.subscriberLimit;
  if (typeof after !== "number" || typeof limit !== "number") return null;
  if (limit <= 0 || after <= limit) return null;
  return `After this import you'll have ${formatCount(after)} contacts. Broadcasts and drips go to your ${formatCount(limit)} most recently active contacts.`;
};

/** "N of M contacts get broadcasts", or null without WhatsApp contacts. */
export const broadcastListLine = (summary?: {
  broadcastEligible?: number;
  whatsapp?: number;
}) =>
  typeof summary?.broadcastEligible === "number" && summary.whatsapp
    ? `${formatCount(summary.broadcastEligible)} of ${formatCount(summary.whatsapp)} contacts get broadcasts`
    : null;

/**
 * A contact's custom fields (from an import or the API) as rows to show,
 * in the order saved. Empty values are left out.
 */
export const customFieldRows = (
  metadata?: Record<string, unknown> | null
): Array<[string, string]> =>
  Object.entries(metadata || {})
    .map(([key, value]): [string, string] => {
      if (value === null || value === undefined) return [key, ""];
      if (typeof value === "boolean") return [key, value ? "Yes" : "No"];
      if (typeof value === "object") return [key, JSON.stringify(value)];
      return [key, String(value).trim()];
    })
    .filter(([key, value]) => key.trim() && value);
