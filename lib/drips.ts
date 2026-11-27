// Drip campaigns: a contact gets 2 to 5 approved templates in order, with a
// wait between each. Plain-language helpers shared by the drip pages.

import type {
  DripJoinedBy,
  DripOnReply,
  DripStatus,
  DripTrigger,
  DripTriggerType,
  DripWaitingReason
} from "@/client-api/types/drips.type";
import type {
  MessageTemplate,
  TemplateComponent
} from "@/client-api/types/templates.type";
import type { StatusPresentation } from "@/lib/statusPresentation";

export const DRIP_MIN_STEPS = 2;
export const DRIP_MAX_STEPS = 5;
export const DRIP_MIN_WAIT_MINUTES = 60;
export const DRIP_MAX_WAIT_DAYS = 60;
export const DRIP_MAX_WAIT_MINUTES = DRIP_MAX_WAIT_DAYS * 24 * 60;
export const DEFAULT_SEND_HOURS = { startHour: 10, endHour: 20 };

/** The quick reply that stops offers in one tap. Matched by its label. */
export const STOP_PROMOTIONS_LABEL = "Stop promotions";

// The labels the server treats as a stop tap (case and punctuation ignored).
const STOP_LABELS = new Set([
  "stop promotions",
  "stop promotion",
  "stop promos",
  "stop promo",
  "stop offers",
  "stop marketing",
  "unsubscribe",
  "unsubscribe from promos",
  "unsubscribe from promotions",
  "unsubscribe from offers"
]);

const normalizeLabel = (value: unknown) =>
  String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export const isStopPromotionsLabel = (value: unknown) =>
  STOP_LABELS.has(normalizeLabel(value));

export const isOfferCategory = (category?: string | null) =>
  String(category || "").toUpperCase() === "MARKETING";

export const hasStopPromotionsButton = (components: TemplateComponent[] = []) =>
  components.some(
    (component) =>
      component.type === "BUTTONS" &&
      (component.buttons || []).some(
        (button) =>
          button.type === "QUICK_REPLY" && isStopPromotionsLabel(button.text)
      )
  );

/**
 * Templates a drip step can use: approved, not a login code, and from the
 * number's WhatsApp account. Text-header values go in the step's components
 * like a broadcast's; an image, video or document header comes from the
 * template's saved file.
 */
export const isDripTemplate = (template: MessageTemplate, wabaId?: string) =>
  template.status.toUpperCase() === "APPROVED" &&
  template.category?.toUpperCase() !== "AUTHENTICATION" &&
  !(wabaId && template.wabaId && template.wabaId !== wabaId);

// ---- Waits ----------------------------------------------------------------

export type WaitUnit = "hours" | "days";

export interface WaitValue {
  /** Step 1 only: send as soon as the contact joins. */
  immediate: boolean;
  /** As typed, so the field can be cleared while editing. */
  amount: string;
  unit: WaitUnit;
}

export const waitFromMinutes = (minutes: number): WaitValue => {
  if (minutes <= 0) return { immediate: true, amount: "1", unit: "days" };
  if (minutes % 1440 === 0) {
    return { immediate: false, amount: String(minutes / 1440), unit: "days" };
  }
  return {
    immediate: false,
    amount: String(Math.max(1, Math.round(minutes / 60))),
    unit: "hours"
  };
};

/** Minutes, or null when the amount isn't a whole number of at least 1. */
export const waitToMinutes = (wait: WaitValue): number | null => {
  if (wait.immediate) return 0;
  const amount = Number(wait.amount);
  if (!Number.isInteger(amount) || amount < 1) return null;
  return amount * (wait.unit === "days" ? 1440 : 60);
};

/** Why this wait can't be saved, or "". */
export const waitProblem = (wait: WaitValue, isFirst: boolean) => {
  const minutes = waitToMinutes(wait);
  if (minutes === null) return "Enter a whole number.";
  if (!isFirst && minutes < DRIP_MIN_WAIT_MINUTES) {
    return "Wait at least 1 hour.";
  }
  if (minutes > DRIP_MAX_WAIT_MINUTES) {
    return `Wait at most ${DRIP_MAX_WAIT_DAYS} days.`;
  }
  return "";
};

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/** "right away", "3 hours", "2 days". */
export const describeWait = (minutes: number) => {
  if (minutes <= 0) return "right away";
  if (minutes % 1440 === 0) return plural(minutes / 1440, "day");
  if (minutes % 60 === 0) return plural(minutes / 60, "hour");
  return plural(minutes, "minute");
};

// ---- Sending hours ---------------------------------------------------------

/** "10:00", "20:00"; 24 is the end of the day. */
export const hourLabel = (hour: number) =>
  hour === 24 ? "Midnight" : `${String(hour).padStart(2, "0")}:00`;

export const sendHoursProblem = (startHour: number, endHour: number) =>
  endHour - startHour < 2
    ? "Sending hours must be at least 2 hours long, within one day."
    : "";

// ---- Status and progress ---------------------------------------------------

export const dripStatusPresentation = (
  status?: DripStatus | null
): StatusPresentation => {
  switch (status) {
    case "draft":
      return { label: "Draft", tone: "grey" };
    case "active":
      return { label: "Running", tone: "green", live: true };
    case "paused":
      return { label: "Paused", tone: "orange" };
    case "archived":
      return { label: "Archived", tone: "grey-outline" };
    default:
      return { label: "Unknown", tone: "grey" };
  }
};

export const DRIP_WAITING_TEXT: Record<DripWaitingReason, string> = {
  sending_hours: "Waiting for sending hours",
  once_a_day: "Waiting, one offer a day",
  daily_limit: "Waiting, daily WhatsApp sending limit reached",
  whatsapp_limit_retry: "Trying once more after a day",
  chatting: "Waiting, they're chatting",
  workspace_paused: "Waiting: workspace paused"
};

// ---- Automatic drips ---------------------------------------------------------

export const MAX_GOAL_TAGS = 10;

export const ON_REPLY_OPTIONS: Array<{ value: DripOnReply; label: string }> = [
  { value: "pause", label: "Pause while they're chatting (recommended)" },
  { value: "stop", label: "Stop the drip" },
  { value: "continue", label: "Keep going" }
];

/** Until someone picks: stop for drips you fill, pause for the others. */
export const defaultOnReply = (
  triggerType: DripTrigger["type"]
): DripOnReply => (triggerType === "manual" ? "stop" : "pause");

export const isTagDrip = (drip?: { trigger?: DripTrigger | null } | null) =>
  drip?.trigger?.type === "tag_added" && Boolean(drip.trigger.tag);

/** People join on their own (anything but "I add people"). */
export const isAutomaticDrip = (
  drip?: { trigger?: DripTrigger | null } | null
) => Boolean(drip?.trigger?.type) && drip?.trigger?.type !== "manual";

export const MAX_TRIGGER_ADS = 20;

/** "Starts when" in the builder's words. */
export const DRIP_TRIGGER_TEXT: Record<
  DripTriggerType,
  { label: string; help: string; joins: string }
> = {
  manual: {
    label: "I add people",
    help: "You choose who joins when you start it, and can add more later.",
    joins: "Someone joins the drip"
  },
  tag_added: {
    label: "A contact gets a tag",
    help: "Anyone who gets the tag joins on their own.",
    joins: "Someone gets the tag"
  },
  ad_lead: {
    label: "Someone messages you from an ad",
    help: "Good for following up on leads from your Click-to-WhatsApp ads.",
    joins: "Someone messages you from an ad"
  },
  first_message: {
    label: "Someone messages you for the first time",
    help: "A welcome series for new contacts. Includes people you imported who write to you for the first time.",
    joins: "Someone messages you for the first time"
  },
  order_placed: {
    label: "Someone places an order",
    help: "Thank-you, review request or cross-sell after a purchase. If the order is cancelled, they leave the drip.",
    joins: "Someone places an order"
  }
};

/** How a person joined, on the People tab of an automatic drip. */
export const JOINED_BY_LABEL: Record<DripJoinedBy, string> = {
  hand: "Added by you",
  tag: "By tag",
  ad: "From an ad",
  first_message: "First message",
  order: "Ordered"
};

/**
 * The Joined tile's line: "5 by tag, 3 added by you" or "12 automatically",
 * leaving out "added by you" at 0. Empty for drips you fill.
 */
export const joinedBreakdown = (
  drip: { trigger?: DripTrigger | null },
  joined?: { byHand: number; byTag: number; automatic?: number } | null
) => {
  if (!joined || !isAutomaticDrip(drip)) return "";
  const count = (value: number) => value.toLocaleString("en-IN");
  const automatic = isTagDrip(drip)
    ? `${count(joined.byTag)} by tag`
    : `${count(joined.automatic ?? 0)} automatically`;
  return joined.byHand > 0
    ? `${automatic}, ${count(joined.byHand)} added by you`
    : automatic;
};

/** The server's message as written, or the fallback. */
export const dripErrorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } } | null)?.response
    ?.data?.message || fallback;
