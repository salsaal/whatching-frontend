// Pure helpers for the Store page (WooCommerce order messages), kept out of
// the components so they can be unit-tested. Wording follows the backend's
// docs/STORE_FRONTEND_SPEC.md.

import type { AxiosError } from "axios";

import type {
  StoreCodState,
  StoreConnection,
  StoreCustomStatusRule,
  StoreFixedMessageKind,
  StorePlatform,
  StoreResponse,
  StoreSettings,
  StoreTemplateChoice
} from "@/client-api/types/stores.type";
import type { BadgeTone } from "@/lib/statusPresentation";

export const STORE_MESSAGE_KINDS: StoreFixedMessageKind[] = [
  "order_confirmed",
  "cod_confirmation",
  "order_shipped",
  "order_cancelled"
];

export const STORE_MESSAGE_COPY: Record<
  StoreFixedMessageKind,
  { title: string; help: string }
> = {
  order_confirmed: {
    title: "Order confirmed",
    help: "Sent when a paid order is placed."
  },
  cod_confirmation: {
    title: "Cash on delivery check",
    help: "Sent instead of “Order confirmed” for cash-on-delivery orders. Has Confirm and Cancel buttons."
  },
  order_shipped: {
    title: "Order completed / shipped",
    help: "Sent when the order reaches the status chosen below (default “Completed”)."
  },
  order_cancelled: { title: "Order cancelled", help: "" }
};

// Shopify has no order statuses to pick: fulfilling the order sends it.
const SHOPIFY_MESSAGE_COPY: Partial<
  Record<StoreFixedMessageKind, { title: string; help: string }>
> = {
  order_shipped: {
    title: "Order shipped",
    help: "Sent when you mark the order fulfilled in Shopify."
  }
};

/** A message card's title and help text, worded for the store's platform. */
export const storeMessageCopy = (
  kind: StoreFixedMessageKind,
  platform?: StorePlatform
) =>
  (platform === "shopify" && SHOPIFY_MESSAGE_COPY[kind]) ||
  STORE_MESSAGE_COPY[kind];

export const COD_STATE_LABELS: Record<StoreCodState, string> = {
  awaiting: "Waiting for customer",
  confirmed: "Confirmed",
  cancel_requested: "Asked to cancel",
  cancelled: "Cancelled by customer",
  no_reply: "No reply"
};

export const MAX_CUSTOM_STATUS_RULES = 10;

// Statuses with a card of their own, or that never get a message; the
// backend refuses them as extra status messages.
const RESERVED_STATUSES = [
  "processing",
  "on-hold",
  "cancelled",
  "pending",
  "failed",
  "checkout-draft",
  "trash"
];

/** Statuses an extra status message can't use. */
export const unavailableCustomStatuses = (shippedStatuses: string[] = []) =>
  new Set([...RESERVED_STATUSES, ...shippedStatuses]);

export type StoreScreen = "plan" | "connect" | "connected";

/** Which screen the Store page shows for the GET /stores answer. */
export const storeScreen = (data: StoreResponse["data"]): StoreScreen => {
  const status = data.connection?.status;
  const isLive =
    status === "connected" ||
    status === "connecting" ||
    status === "needs_attention";
  // A live store stays manageable after a downgrade (a banner explains).
  if (isLive) return "connected";
  return data.enabledForPlan ? "connect" : "plan";
};

export const storeStatusPresentation = (
  status?: StoreConnection["status"]
): { label: string; tone: BadgeTone } => {
  switch (status) {
    case "connected":
      return { label: "Connected", tone: "green" };
    case "needs_attention":
      return { label: "Needs attention", tone: "amber" };
    default:
      return { label: "Setting up", tone: "grey" };
  }
};

export type ReturnOutcome = "waiting" | "connected" | "failed";

/** What the WooCommerce return page does with the latest GET /stores. */
export const storeReturnOutcome = (
  connection?: StoreConnection | null
): ReturnOutcome => {
  if (connection?.status === "connected") return "connected";
  // needs_attention only follows a finished setup, so it's connected too.
  if (connection?.status === "needs_attention") return "connected";
  if (connection?.status === "disconnected" && connection.setupFailure) {
    return "failed";
  }
  return "waiting";
};

/** One message's outcome on an order, in plain words. */
export const storeMessageStatusPresentation = (
  status?: string | null
): { label: string; tone: BadgeTone } => {
  switch (status) {
    case "read":
      return { label: "Read", tone: "green" };
    case "delivered":
      return { label: "Delivered", tone: "green" };
    case "sent":
      return { label: "Sent", tone: "blue" };
    case "failed":
      return { label: "Failed", tone: "red" };
    case "skipped":
      return { label: "Not sent", tone: "grey" };
    default:
      // claimed, queued, sending: on its way.
      return { label: "Sending", tone: "grey" };
  }
};

/** The card title for a message kind, including extra status messages. */
export const storeMessageTitle = (
  kind: string,
  customRules: StoreCustomStatusRule[] = [],
  platform?: StorePlatform
) => {
  if (kind in STORE_MESSAGE_COPY) {
    return storeMessageCopy(kind as StoreFixedMessageKind, platform).title;
  }
  if (kind.startsWith("status_")) {
    const slug = kind.slice("status_".length);
    const rule = customRules.find((entry) => entry.status === slug);
    return rule?.statusLabel || humanizeStatus(slug);
  }
  return humanizeStatus(kind);
};

/** "out-for-delivery" as "Out for delivery". */
export const humanizeStatus = (slug: string) => {
  const words = slug.replace(/^wc-/, "").replace(/[-_]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : slug;
};

/** "1201" as "#1201"; Shopify's numbers come without the "#". */
export const formatOrderNumber = (orderNumber?: string | number | null) =>
  `#${String(orderNumber ?? "").replace(/^#+/, "")}`;

export const formatOrderTotal = (total?: string | null, currency?: string) => {
  const amount = Number(total);
  if (total === undefined || total === null || !Number.isFinite(amount)) {
    return total || "-";
  }
  if (currency) {
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency
      }).format(amount);
    } catch {
      // Unknown currency code: fall through to the plain form.
    }
  }
  return [amount.toFixed(2), currency].filter(Boolean).join(" ");
};

/** Select value for a template choice; names can't contain "::". */
export const templateChoiceKey = (
  name?: string | null,
  language?: string | null
) => (name && language ? `${name}::${language}` : "");

export const parseTemplateChoiceKey = (key: string) => {
  const [name, language] = key.split("::");
  return name && language ? { name, language } : null;
};

/**
 * Templates a store message can pick: approved or in review, from the
 * WhatsApp account of the sending number when that's known. Approved
 * first.
 */
export const storeTemplateOptions = <T extends StoreTemplateChoice>(
  templates: T[],
  wabaId?: string | null
) =>
  templates
    .filter((template) => {
      const status = String(template.status || "").toUpperCase();
      if (status !== "APPROVED" && status !== "PENDING") return false;
      return !wabaId || !template.wabaId || template.wabaId === wabaId;
    })
    .sort((a, b) => {
      const approvedA = String(a.status).toUpperCase() === "APPROVED" ? 0 : 1;
      const approvedB = String(b.status).toUpperCase() === "APPROVED" ? 0 : 1;
      return approvedA - approvedB || a.name.localeCompare(b.name);
    });

/**
 * Whether every message that's on has a template (`chosen`), and whether
 * all of those are approved by WhatsApp (`ready`).
 */
export const storeTemplatesState = (
  messages: StoreSettings["messages"] = {},
  templates: StoreTemplateChoice[]
) => {
  const isOn = (kind: StoreFixedMessageKind) =>
    messages[kind]?.enabled !== false;
  const chosen = STORE_MESSAGE_KINDS.every(
    (kind) => !isOn(kind) || Boolean(messages[kind]?.templateName)
  );
  const ready = STORE_MESSAGE_KINDS.every((kind) => {
    if (!isOn(kind)) return true;
    const setting = messages[kind];
    const template = templates.find(
      (entry) =>
        entry.name === setting?.templateName &&
        entry.language === setting?.templateLanguage
    );
    return String(template?.status || "").toUpperCase() === "APPROVED";
  });
  return { chosen, ready };
};

/** "mystore.com/" and "https://mystore.com" read the same in a sentence. */
export const displayStoreUrl = (url?: string | null) =>
  (url || "").replace(/^https?:\/\//i, "").replace(/\/+$/, "");

export const isNotFoundError = (error: unknown) =>
  (error as AxiosError | null)?.response?.status === 404;

/** The API's own message: store errors already come in plain words. */
export const storeErrorMessage = (error: unknown, fallback: string) =>
  (error as AxiosError<{ message?: string }> | null)?.response?.data?.message ||
  fallback;
