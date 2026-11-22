// Pure helpers for the tabbed Store page (WooCommerce) and the places the
// Store shows up in other tabs. Wording follows the backend's
// docs/STORE_REDESIGN_FRONTEND_SPEC.md. The screens inside Shopify admin
// don't use these.

import type {
  StoreCodState,
  StoreConnection,
  StoreCustomStatusRule,
  StoreFixedMessageKind,
  StoreOrdersShow,
  StoreSummary,
  StoreTemplateChoice,
  StoreTemplateVariable
} from "@/client-api/types/stores.type";
import { formatCount } from "@/lib/displayFormat";
import type { BadgeTone } from "@/lib/statusPresentation";
import {
  COD_STATE_LABELS,
  STORE_MESSAGE_KINDS,
  formatOrderTotal,
  humanizeStatus
} from "@/lib/store";

// ---- Tabs and filters (kept in the URL) -----------------------------------

export const STORE_TABS = [
  { id: "overview", label: "Overview" },
  { id: "messages", label: "Order messages" },
  { id: "carts", label: "Cart reminders" },
  { id: "activity", label: "Activity" }
] as const;

export type StoreTab = (typeof STORE_TABS)[number]["id"];

export const parseStoreTab = (value: unknown): StoreTab =>
  STORE_TABS.some((tab) => tab.id === value) ? (value as StoreTab) : "overview";

export const STORE_ORDER_FILTERS: { id: StoreOrdersShow; label: string }[] = [
  { id: "all", label: "All" },
  { id: "not_sent", label: "Not sent" },
  { id: "cod_waiting", label: "Waiting for customer" }
];

export const parseOrdersShow = (value: unknown): StoreOrdersShow =>
  STORE_ORDER_FILTERS.some((filter) => filter.id === value)
    ? (value as StoreOrdersShow)
    : "all";

export type StoreActivityView = "orders" | "carts";

export const parseActivityView = (value: unknown): StoreActivityView =>
  value === "carts" ? "carts" : "orders";

/** The empty Orders list, per filter. */
export const STORE_ORDERS_EMPTY: Record<StoreOrdersShow, string> = {
  all: "No orders yet. New orders from your store show up here.",
  not_sent: "Nothing to fix. Every message went out.",
  cod_waiting: "No cash-on-delivery orders are waiting for an answer."
};

// ---- Message names and when each is sent ----------------------------------

/** Names on the Store page (the Templates tab uses the backend's). */
export const STORE_PAGE_MESSAGE_TITLES: Record<StoreFixedMessageKind, string> =
  {
    order_confirmed: "Order confirmed",
    cod_confirmation: "Cash on delivery check",
    order_shipped: "Order completed",
    order_cancelled: "Order cancelled"
  };

export const customRuleLabel = (rule: StoreCustomStatusRule) =>
  rule.statusLabel || humanizeStatus(rule.status);

/** A message's name on the Store page, including extra status messages. */
export const storePageMessageTitle = (
  kind: string,
  customRules: StoreCustomStatusRule[] = []
) => {
  if (kind in STORE_PAGE_MESSAGE_TITLES) {
    return STORE_PAGE_MESSAGE_TITLES[kind as StoreFixedMessageKind];
  }
  if (kind.startsWith("status_")) {
    const slug = kind.slice("status_".length);
    const rule = customRules.find((entry) => entry.status === slug);
    return rule ? customRuleLabel(rule) : humanizeStatus(slug);
  }
  return humanizeStatus(kind);
};

/** The Overview's line for when a message is sent. */
export const overviewWhen = (
  kind: StoreFixedMessageKind,
  shippedLabel: string
) => {
  switch (kind) {
    case "order_confirmed":
      return "When a paid order is placed";
    case "cod_confirmation":
      return "Instead of “Order confirmed” for cash-on-delivery orders, with Confirm and Cancel buttons";
    case "order_shipped":
      return `When the order is marked ${shippedLabel}`;
    default:
      return "When the order is cancelled in your store";
  }
};

/** The Order messages tab's line for when a message is sent. */
export const ORDER_MESSAGE_WHEN: Record<StoreFixedMessageKind, string> = {
  order_confirmed: "Sent when a paid order is placed.",
  cod_confirmation:
    "Sent instead of “Order confirmed” for cash-on-delivery orders. Has Confirm and Cancel buttons.",
  order_shipped: "Sent when the order reaches the status you choose.",
  order_cancelled: "Sent when the order is cancelled in your store."
};

export interface JourneyRow {
  key: string;
  title: string;
  when: string;
  on: boolean;
}

/** "What your customers receive": the fixed messages, then extra statuses. */
export const storeJourney = (
  connection: StoreConnection,
  statusName: (slug: string) => string = humanizeStatus
): JourneyRow[] => {
  const messages = connection.settings?.messages || {};
  const shippedLabel = statusName(
    connection.settings?.shippedStatuses?.[0] || "completed"
  );
  const fixed = STORE_MESSAGE_KINDS.map((kind) => ({
    key: kind,
    title: STORE_PAGE_MESSAGE_TITLES[kind],
    when: overviewWhen(kind, shippedLabel),
    on: messages[kind]?.enabled !== false
  }));
  const extra = (connection.settings?.customStatusRules || []).map((rule) => ({
    key: `status_${rule.status}`,
    title: customRuleLabel(rule),
    when: `When the order moves to ${customRuleLabel(rule)}`,
    on: rule.enabled !== false
  }));
  return [...fixed, ...extra];
};

// ---- Templates on the Store page ------------------------------------------

const findTemplate = <T extends StoreTemplateChoice>(
  templates: T[],
  name?: string | null,
  language?: string | null
) =>
  name
    ? templates.find(
        (template) => template.name === name && template.language === language
      )
    : undefined;

export type StoreTemplateUsability = "approved" | "review" | "unusable";

const usability = (status?: string | null): StoreTemplateUsability => {
  const upper = String(status || "").toUpperCase();
  if (upper === "APPROVED") return "approved";
  if (upper === "PENDING" || upper === "IN_REVIEW") return "review";
  return "unusable";
};

/**
 * The pill next to a message's template: null when none is chosen.
 * `missing`: the chosen template is gone from the account.
 */
export const storeTemplatePill = (
  name: string | null | undefined,
  language: string | null | undefined,
  templates: StoreTemplateChoice[]
): { label: string; tone: BadgeTone; missing?: boolean } | null => {
  if (!name) return null;
  const template = findTemplate(templates, name, language);
  if (!template) {
    return {
      label: "This template no longer exists. Choose another one.",
      tone: "red",
      missing: true
    };
  }
  switch (usability(template.status)) {
    case "approved":
      return { label: "Approved by WhatsApp", tone: "green" };
    case "review":
      return { label: "In review", tone: "amber" };
    default:
      return { label: "Not approved", tone: "red" };
  }
};

/** The first ~60 characters of a template's text, for the picker. */
export const templateBodyPreview = (
  template: Pick<StoreTemplateChoice, "components">,
  max = 60
) => {
  const body = (template.components || []).find(
    (component) => String(component.type).toUpperCase() === "BODY"
  );
  const text = String(body?.text || "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
};

// ---- Preview sample values ------------------------------------------------

type SampleKey =
  | "firstName"
  | "orderNumber"
  | "storeName"
  | "orderTotal"
  | "orderStatus"
  | "cartItems"
  | "cartTotal";

// {{1}}, {{2}}… per message type, as the backend fills them.
const KEYS_BY_KIND: Record<string, SampleKey[]> = {
  order_confirmed: ["firstName", "orderNumber", "storeName", "orderTotal"],
  cod_confirmation: ["firstName", "orderNumber", "storeName", "orderTotal"],
  order_shipped: ["firstName", "orderNumber", "storeName"],
  order_cancelled: ["firstName", "orderNumber", "storeName"],
  custom_status: ["firstName", "orderNumber", "storeName", "orderStatus"],
  cart_reminder: ["firstName", "cartItems", "storeName", "cartTotal"]
};

const KEY_BY_LABEL: Record<string, SampleKey> = {
  "customer’s first name": "firstName",
  "customer's first name": "firstName",
  "order number": "orderNumber",
  "store name": "storeName",
  "order total": "orderTotal",
  "order status": "orderStatus",
  "items in the cart": "cartItems",
  "cart total": "cartTotal"
};

/**
 * What fills each {{n}} in a preview: "Zaki", order 1042, the store's name,
 * ₹499.00 (or a cart of "Test Mug" for ₹299.00), and the status label.
 * Keyed "1", "2"… for WhatsAppPreview.
 */
export const storePreviewValues = (
  kind: string,
  variables: StoreTemplateVariable[] | undefined,
  context: { storeName: string; currency?: string; statusLabel?: string }
): Record<string, string> => {
  const samples: Record<SampleKey, string> = {
    firstName: "Zaki",
    orderNumber: "1042",
    storeName: context.storeName,
    orderTotal: formatOrderTotal("499.00", context.currency || "INR"),
    orderStatus: context.statusLabel || "",
    cartItems: "Test Mug",
    cartTotal: formatOrderTotal("299.00", context.currency || "INR")
  };
  const keys =
    KEYS_BY_KIND[kind.startsWith("status_") ? "custom_status" : kind] || [];
  const values: Record<string, string> = {};
  keys.forEach((key, index) => {
    values[String(index + 1)] = samples[key];
  });
  for (const variable of variables || []) {
    const number = variable.variable.match(/\d+/)?.[0];
    const key = KEY_BY_LABEL[variable.label.trim().toLowerCase()];
    if (number && key) values[number] = samples[key];
  }
  return values;
};

// ---- Summary row ----------------------------------------------------------

const plural = (count: number, one: string, many: string) =>
  `${formatCount(count)} ${count === 1 ? one : many}`;

export interface SummaryTile {
  id: "orders" | "cod" | "carts" | "notSent";
  label: string;
  value: string;
  sub: string;
  /** "See Activity for why": where it leads. */
  opens?: { view: StoreActivityView; show?: StoreOrdersShow };
}

export const storeSummaryTiles = (
  summary: StoreSummary,
  { pluginLinked }: { pluginLinked: boolean }
): SummaryTile[] => {
  const { cod, carts, notSent } = summary;
  const codLine = [
    `${formatCount(cod.cancelled + cod.cancelRequested)} cancelled`,
    `${formatCount(cod.noReply)} no reply`,
    cod.waiting > 0 ? `${formatCount(cod.waiting)} waiting` : null
  ]
    .filter(Boolean)
    .join(" · ");
  const recovered = carts.recoveredTotals[0];
  const notSentCount = notSent.orders + notSent.cartReminders;
  return [
    {
      id: "orders",
      label: "Orders messaged",
      value: formatCount(summary.ordersMessaged),
      sub: "This month"
    },
    {
      id: "cod",
      label: "Cash on delivery",
      value: `${formatCount(cod.confirmed)} confirmed`,
      sub: codLine
    },
    {
      id: "carts",
      label: "Carts recovered",
      value: recovered
        ? formatOrderTotal(recovered.amount, recovered.currency || undefined)
        : "—",
      sub: pluginLinked
        ? `${plural(carts.recoveredCount, "cart", "carts")} this month`
        : "Link the plugin to start"
    },
    {
      id: "notSent",
      label: "Messages not sent",
      value: formatCount(notSentCount),
      sub: notSentCount === 0 ? "All good" : "See Activity for why",
      // Cart reminders only: the Carts list shows why.
      opens:
        notSentCount === 0
          ? undefined
          : notSent.orders > 0
            ? { view: "orders", show: "not_sent" }
            : { view: "carts" }
    }
  ];
};

/** "Recovered this month: 3 carts · ₹897.00". */
export const recoveredThisMonth = (summary: StoreSummary) => {
  const amounts = summary.carts.recoveredTotals
    .map((entry) =>
      formatOrderTotal(entry.amount, entry.currency || undefined)
    )
    .join(" · ");
  return [
    `Recovered this month: ${plural(summary.carts.recoveredCount, "cart", "carts")}`,
    amounts
  ]
    .filter(Boolean)
    .join(" · ");
};

// ---- Setup checklist ------------------------------------------------------

export interface SetupStep {
  id: "store" | "templates" | "sender" | "carts";
  label: string;
  note: string;
  done: boolean;
  /** The button under the list for a step that needs action. */
  action?: "templates" | "sender" | "plugin";
  /** A second line in amber: what's holding the step up. */
  hint?: string;
}

export const storeSetupSteps = ({
  connection,
  templates,
  numberCount,
  senderLabel,
  showCarts
}: {
  connection: StoreConnection;
  templates: StoreTemplateChoice[];
  numberCount: number;
  /** The sending number as shown, or null when none is chosen. */
  senderLabel: string | null;
  showCarts: boolean;
}): SetupStep[] => {
  const settings = connection.settings || {};
  const steps: SetupStep[] = [];

  steps.push(
    connection.status === "connected"
      ? {
          id: "store",
          label: "Store connected",
          note: "Orders reach Whatching",
          done: true
        }
      : connection.status === "needs_attention"
        ? {
            id: "store",
            label: "Store connected",
            note:
              connection.attention?.message ||
              "Whatching can't reach your store right now.",
            done: false
          }
        : {
            id: "store",
            label: "Store connected",
            note: "Finishing setup. This usually takes a minute.",
            done: false
          }
  );

  // The messages that are on: the four, then extra statuses.
  const messages = settings.messages || {};
  const onFixed = STORE_MESSAGE_KINDS.filter(
    (kind) => messages[kind]?.enabled !== false
  ).map((kind) => messages[kind] || {});
  const onExtra = (settings.customStatusRules || []).filter(
    (rule) => rule.enabled !== false
  );
  const on = [...onFixed, ...onExtra];
  const state = (entry: { templateName?: string | null; templateLanguage?: string | null }) =>
    usability(
      findTemplate(templates, entry.templateName, entry.templateLanguage)
        ?.status
    );
  const approved = on.filter((entry) => state(entry) === "approved").length;
  // Ready-made templates fix a missing or refused one (the four fixed
  // messages); an extra status message needs one chosen by hand; in
  // review only waits.
  const fixedNeedTemplate = onFixed.some(
    (entry) => state(entry) === "unusable"
  );
  const anyUnusable = on.some((entry) => state(entry) === "unusable");
  const anyInReview = on.some((entry) => state(entry) === "review");
  steps.push({
    id: "templates",
    label: "Message templates approved",
    note: on.length
      ? `${formatCount(approved)} of ${formatCount(on.length)} approved by WhatsApp`
      : "No messages are turned on",
    done: on.length > 0 && approved === on.length,
    action: fixedNeedTemplate ? "templates" : undefined,
    hint: fixedNeedTemplate
      ? undefined
      : anyUnusable
        ? "Choose an approved template for each message in Order messages."
        : anyInReview
          ? "Waiting for WhatsApp to approve your templates. This usually takes a few minutes."
          : undefined
  });

  if (numberCount > 1) {
    steps.push({
      id: "sender",
      label: "Sending number",
      note: senderLabel || "Choose which number sends your store messages",
      done: Boolean(senderLabel),
      action: senderLabel ? undefined : "sender"
    });
  }

  if (showCarts) {
    const linked = connection.plugin?.connected === true;
    steps.push({
      id: "carts",
      label: "Cart reminders",
      note: !linked
        ? "Install and link the plugin to turn them on"
        : settings.cartReminders?.enabled
          ? "Reminders on"
          : "Reminders off",
      done: linked,
      action: linked ? undefined : "plugin"
    });
  }
  return steps;
};

// ---- Activity -------------------------------------------------------------

/** Cash-on-delivery state as a coloured pill. */
export const codStatePresentation = (
  state: StoreCodState
): { label: string; tone: BadgeTone } => {
  const tone: Record<StoreCodState, BadgeTone> = {
    awaiting: "amber",
    confirmed: "green",
    cancel_requested: "red",
    cancelled: "red",
    no_reply: "grey"
  };
  return { label: COD_STATE_LABELS[state], tone: tone[state] };
};

/** "cod" reads as "Cash on delivery"; other codes as they are. */
export const paymentMethodLabel = (code: string) =>
  code === "cod" ? "Cash on delivery" : code;

// ---- A disconnected store's history ---------------------------------------

const HISTORY_KEPT_DAYS = 30;
const dayMonth = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short"
});

/** "21 Dec". */
export const formatDayMonth = (value: Date) => dayMonth.format(value);

/** When a disconnected store's orders are deleted; null once they are. */
export const storeHistoryKeptUntil = (
  connection: StoreConnection | null | undefined,
  now: Date = new Date()
) => {
  if (connection?.status !== "disconnected" || !connection.disconnectedAt) {
    return null;
  }
  const since = new Date(connection.disconnectedAt).getTime();
  if (!Number.isFinite(since)) return null;
  const until = new Date(since + HISTORY_KEPT_DAYS * 24 * 60 * 60 * 1000);
  return until.getTime() > now.getTime() ? until : null;
};

/** The owner disconnected it (not a setup that failed). */
export const disconnectedByOwner = (
  connection: StoreConnection | null | undefined
) =>
  connection?.status === "disconnected" &&
  !connection.setupFailure &&
  Boolean(connection.disconnectedAt);

// ---- The Templates tab ----------------------------------------------------

const ACTIVE_STATUSES = ["connecting", "connected", "needs_attention"];

// The names the backend uses when it refuses a delete.
const USE_LABELS: Record<StoreFixedMessageKind, string> = {
  order_confirmed: "Order confirmed",
  cod_confirmation: "Cash on delivery check",
  order_shipped: "Order completed / shipped",
  order_cancelled: "Order cancelled"
};

const sameTemplate = (
  setting: { templateName?: string | null; templateLanguage?: string | null },
  name: string,
  language?: string | null
) =>
  setting.templateName === name &&
  (!language ||
    !setting.templateLanguage ||
    setting.templateLanguage === language);

/**
 * The Store messages that send this template, as the backend counts them
 * when it refuses a delete: turned-on messages of a live store.
 */
export const storeTemplateUses = (
  connection: StoreConnection | null | undefined,
  name: string,
  language?: string | null
): string[] => {
  if (!connection || !ACTIVE_STATUSES.includes(connection.status)) return [];
  const settings = connection.settings || {};
  const uses: string[] = [];
  for (const kind of STORE_MESSAGE_KINDS) {
    const setting = settings.messages?.[kind];
    if (setting?.enabled && sameTemplate(setting, name, language)) {
      uses.push(USE_LABELS[kind]);
    }
  }
  for (const rule of settings.customStatusRules || []) {
    if (rule.enabled && sameTemplate(rule, name, language)) {
      uses.push(`Order moves to “${customRuleLabel(rule)}”`);
    }
  }
  if (settings.cartReminders?.enabled) {
    (settings.cartReminders.steps || []).forEach((step, index) => {
      if (step.enabled && sameTemplate(step, name, language)) {
        uses.push(`Cart reminder ${index + 1}`);
      }
    });
  }
  return uses;
};

/** "Order confirmed, Cart reminder 1". */
export const listStoreUses = (uses: string[]) => uses.join(", ");
