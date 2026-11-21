// Pure helpers for the Store page's cart reminders and WordPress plugin
// (WooCommerce only). Wording follows the backend's
// docs/STORE_CART_FRONTEND_SPEC.md.

import type {
  StoreCart,
  StoreCartReminderStep,
  StoreCartsResponse,
  StoreConnection,
  StoreTemplateChoice,
  StoreTemplateVariable
} from "@/client-api/types/stores.type";
import type { TemplateComponent } from "@/client-api/types/templates.type";
import { formatRelative } from "@/lib/displayFormat";
import type { BadgeTone } from "@/lib/statusPresentation";
import { formatOrderTotal } from "@/lib/store";

/** The plugin zip, served from public/downloads. */
export const STORE_PLUGIN_DOWNLOAD_URL =
  "/downloads/whatching-cart-recovery.zip";

export const CART_REMINDER_COUNT = 3;
export const CART_REMINDER_MIN_MINUTES = 30;
export const CART_REMINDER_MAX_MINUTES = 72 * 60;
const DEFAULT_DELAYS = [60, 360, 1440];

export const CART_DELAY_RANGE_MESSAGE =
  "Each reminder can be sent between 30 minutes and 72 hours after the shopper leaves.";

/** Older than this, the plugin card asks to check the plugin is active. */
const PLUGIN_QUIET_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * The plugin parts show only for WooCommerce stores, and only when the
 * backend sends `plugin` (it does for WooCommerce stores; null otherwise).
 */
export const hasStorePlugin = (connection?: StoreConnection | null) =>
  connection?.platform === "woocommerce" && Boolean(connection.plugin);

/** "3 h ago" for the plugin's last check-in; "just now" mid-sentence. */
export const pluginLastSeenText = (
  lastSeenAt?: string | null,
  now: Date = new Date()
) => {
  const text = formatRelative(lastSeenAt, now);
  return text === "Just now" ? "just now" : text;
};

/** No check-in from the plugin for over a day. */
export const isPluginQuiet = (
  lastSeenAt?: string | null,
  now: Date = new Date()
) => {
  const seen = lastSeenAt ? new Date(lastSeenAt).getTime() : NaN;
  return Number.isFinite(seen) && now.getTime() - seen > PLUGIN_QUIET_AFTER_MS;
};

/** Always three steps, in order, filling in the backend's defaults. */
export const cartReminderSteps = (
  steps: StoreCartReminderStep[] = []
): StoreCartReminderStep[] =>
  Array.from({ length: CART_REMINDER_COUNT }, (_, index) => ({
    enabled: steps[index]?.enabled !== false,
    delayMinutes: steps[index]?.delayMinutes ?? DEFAULT_DELAYS[index],
    templateName: steps[index]?.templateName || null,
    templateLanguage: steps[index]?.templateName
      ? steps[index]?.templateLanguage || null
      : null
  }));

export type DelayUnit = "minutes" | "hours";
export interface DelayDraft {
  value: string;
  unit: DelayUnit;
}

/** 360 as "6 hours", 90 as "90 minutes". */
export const delayDraftFromMinutes = (minutes: number): DelayDraft =>
  minutes % 60 === 0
    ? { value: String(minutes / 60), unit: "hours" }
    : { value: String(minutes), unit: "minutes" };

/** Whole minutes for the typed delay, or null when it isn't a number. */
export const delayDraftMinutes = ({ value, unit }: DelayDraft) => {
  const amount = Number(value.trim());
  if (!value.trim() || !Number.isFinite(amount)) return null;
  return Math.round(unit === "hours" ? amount * 60 : amount);
};

/**
 * The first problem with the three delays, worded like the backend, with
 * the reminder it belongs to (0-based). All three are checked, on or off,
 * as the backend does.
 */
export const cartDelaysProblem = (
  drafts: DelayDraft[]
): { index: number; message: string } | null => {
  let previous = 0;
  for (const [index, draft] of drafts.entries()) {
    const minutes = delayDraftMinutes(draft);
    if (
      minutes === null ||
      minutes < CART_REMINDER_MIN_MINUTES ||
      minutes > CART_REMINDER_MAX_MINUTES
    ) {
      return { index, message: CART_DELAY_RANGE_MESSAGE };
    }
    if (minutes <= previous) {
      return {
        index,
        message: `Reminder ${index + 1} must be sent later than reminder ${index}.`
      };
    }
    previous = minutes;
  }
  return null;
};

const URL_VARIABLE = /\{\{/;
const ENDS_IN_VARIABLE = /\{\{\s*1\s*\}\}$/;

/**
 * A template a cart reminder can use: Marketing, with exactly one link
 * button whose address ends in {{1}} (the backend fills in the link back
 * to the cart). The backend explains anything else it can't use.
 */
export const isCartReminderTemplate = (
  template: StoreTemplateChoice & { components?: TemplateComponent[] }
) => {
  if (String(template.category || "").toUpperCase() !== "MARKETING") {
    return false;
  }
  const buttons = (template.components || []).flatMap((component) =>
    String(component.type).toUpperCase() === "BUTTONS"
      ? component.buttons || []
      : []
  );
  const variableLinks = buttons.filter(
    (button) =>
      String(button.type).toUpperCase() === "URL" &&
      URL_VARIABLE.test(String(button.url || ""))
  );
  return (
    variableLinks.length === 1 &&
    ENDS_IN_VARIABLE.test(String(variableLinks[0].url))
  );
};

/** Whether the reminders that are on use a template still in review. */
export const cartTemplatesWaiting = (
  steps: StoreCartReminderStep[],
  templates: StoreTemplateChoice[]
) =>
  steps.some((step) => {
    if (step.enabled === false || !step.templateName) return false;
    const template = templates.find(
      (entry) =>
        entry.name === step.templateName &&
        entry.language === step.templateLanguage
    );
    return String(template?.status || "").toUpperCase() !== "APPROVED";
  });

/** The variable chips, falling back to the spec's list. */
export const cartReminderVariables = (
  fromApi?: StoreTemplateVariable[]
): StoreTemplateVariable[] =>
  fromApi?.length
    ? fromApi
    : [
        { variable: "{{1}}", label: "Customer's first name" },
        { variable: "{{2}}", label: "Cart items" },
        { variable: "{{3}}", label: "Store name" },
        { variable: "{{4}}", label: "Cart total" }
      ];

/** A cart's status in the reminder log, with its help text. */
export const storeCartStatusPresentation = (
  cart: Pick<
    StoreCart,
    "status" | "recovered" | "orderNumber" | "stopReason" | "nextReminderAt"
  >,
  now: Date = new Date()
): { label: string; tone: BadgeTone; help?: string } => {
  const number = String(cart.orderNumber ?? "").replace(/^#+/, "");
  switch (cart.status) {
    case "open": {
      if (!cart.nextReminderAt) return { label: "Waiting", tone: "grey" };
      const due = new Date(cart.nextReminderAt).getTime();
      return {
        label:
          Number.isFinite(due) && due > now.getTime()
            ? `Reminder due ${formatRelative(cart.nextReminderAt, now)}`
            : "Reminder due now",
        tone: "blue"
      };
    }
    case "converted":
      return cart.recovered
        ? {
            label: number ? `Recovered · order #${number}` : "Recovered",
            tone: "green"
          }
        : { label: number ? `Ordered · #${number}` : "Ordered", tone: "green" };
    case "stopped":
      return {
        label: "Stopped",
        tone: "grey",
        help: cart.stopReason || undefined
      };
    case "expired":
      return { label: "Expired", tone: "grey" };
    default:
      return { label: String(cart.status || "-"), tone: "grey" };
  }
};

/** "₹299.00 · $12.00": one amount per currency. */
export const formatRecoveredTotals = (
  totals: StoreCartsResponse["data"]["summary"]["recoveredTotals"] = []
) =>
  totals
    .map((entry) => formatOrderTotal(entry.amount, entry.currency || undefined))
    .join(" · ");
