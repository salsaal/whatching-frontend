// Store connections (WooCommerce order messages). Shapes follow the
// backend's /organizations/stores routes; see docs/STORE_FRONTEND_SPEC.md
// in the backend repo. The screens inside Shopify admin get the same shapes
// from /shopify/store (types/shopify.type.ts).

import type { MessageTemplate } from "./templates.type";

export type StoreConnectionStatus =
  | "pending"
  | "connecting"
  | "connected"
  | "needs_attention"
  | "disconnected";

export type StoreFixedMessageKind =
  | "order_confirmed"
  | "cod_confirmation"
  | "order_shipped"
  | "order_cancelled";

export interface StoreMessageSetting {
  enabled?: boolean;
  templateName?: string | null;
  templateLanguage?: string | null;
}

export interface StoreCustomStatusRule {
  status: string;
  statusLabel?: string;
  enabled?: boolean;
  templateName?: string | null;
  templateLanguage?: string | null;
}

/** One of the three cart reminders: sent this long after the shopper leaves. */
export interface StoreCartReminderStep {
  enabled?: boolean;
  delayMinutes: number;
  templateName?: string | null;
  templateLanguage?: string | null;
}

export interface StoreCartReminderSettings {
  enabled?: boolean;
  /** Set once the merchant confirms their store collects marketing consent. */
  consentConfirmedAt?: string | null;
  consentConfirmedBy?: string | null;
  steps?: StoreCartReminderStep[];
}

export interface StoreSettings {
  senderPhoneNumberId?: string;
  shippedStatuses?: string[];
  messages?: Partial<Record<StoreFixedMessageKind, StoreMessageSetting>>;
  customStatusRules?: StoreCustomStatusRule[];
  cod?: { autoCancel?: boolean; paymentMethods?: string[] };
  /** WooCommerce only. */
  cartReminders?: StoreCartReminderSettings;
}

/** The Whatching WordPress plugin (cart reminders), WooCommerce only. */
export interface StorePluginInfo {
  connected: boolean;
  connectedAt?: string | null;
  version?: string | null;
  /** The plugin's last check-in. */
  lastSeenAt?: string | null;
}

/** WooCommerce from the Store page; Shopify from inside Shopify admin. */
export type StorePlatform = "woocommerce" | "shopify";

export interface StoreConnection {
  id: string;
  platform: StorePlatform;
  status: StoreConnectionStatus;
  storeUrl: string;
  storeName: string;
  connectedAt?: string | null;
  lastSyncAt?: string | null;
  lastWebhookAt?: string | null;
  attention?: {
    reason?:
      | "access_removed"
      | "unreachable"
      | "reconnect_in_shopify"
      | string
      | null;
    message?: string | null;
  } | null;
  setupFailure?: { message: string } | null;
  disconnectedAt?: string | null;
  settings?: StoreSettings;
  /**
   * WooCommerce stores, once the backend has cart reminders (null for
   * Shopify; missing before then, which keeps those parts hidden).
   */
  plugin?: StorePluginInfo | null;
}

/** What a store message's template picker needs from a template. */
export type StoreTemplateChoice = Pick<
  MessageTemplate,
  "name" | "language" | "category" | "status"
> & { wabaId?: string };

export interface StoreTemplateVariable {
  variable: string;
  label: string;
}

export interface ReadyMadeStoreTemplate {
  kind: StoreFixedMessageKind;
  name: string;
  body: string;
  /** Quick-reply button labels, e.g. Confirm order, Cancel order. */
  buttons: string[];
}

/** The ready-made cart reminder (a Marketing template with a link button). */
export interface ReadyMadeCartTemplate {
  name: string;
  body: string;
  linkButton: string;
}

export interface StoreResponse {
  status: string;
  data: {
    enabledForPlan: boolean;
    connection: StoreConnection | null;
    /**
     * Per message type, plus `custom_status` for extra status messages
     * and `cart_reminder` for cart reminders.
     */
    templateVariables: Record<string, StoreTemplateVariable[]>;
    readyMadeTemplates: ReadyMadeStoreTemplate[];
    readyMadeCartTemplate?: ReadyMadeCartTemplate;
  };
}

export interface ConnectWooCommercePayload {
  storeUrl: string;
  storeName?: string;
  optInConfirmed: boolean;
}

export interface ConnectWooCommerceResponse {
  status: string;
  data: { authorizeUrl: string; connection: StoreConnection };
}

export interface UpdateStoreSettingsPayload {
  storeName?: string;
  senderPhoneNumberId?: string | null;
  shippedStatuses?: string[];
  messages?: Partial<Record<StoreFixedMessageKind, StoreMessageSetting>>;
  customStatusRules?: StoreCustomStatusRule[];
  cod?: { autoCancel?: boolean; paymentMethods?: string[] };
  /**
   * `consentConfirmed` only with the first `enabled: true`; `steps` is
   * always all three, in order.
   */
  cartReminders?: {
    enabled?: boolean;
    consentConfirmed?: boolean;
    steps?: StoreCartReminderStep[];
  };
}

export interface UpdateStoreSettingsResponse {
  status: string;
  data: { connection: StoreConnection; warnings: string[] };
}

export interface CreateStoreTemplatesPayload {
  language: string;
  kinds?: StoreFixedMessageKind[];
  bodyOverrides?: Partial<Record<StoreFixedMessageKind, string>>;
}

export interface StoreTemplateResult {
  kind: StoreFixedMessageKind;
  outcome: "created" | "already_existed" | "failed";
  templateName?: string;
  language?: string;
  status?: string;
  category?: string;
  message?: string;
}

export interface CreateStoreTemplatesResponse {
  status: string;
  data: { results: StoreTemplateResult[] };
}

export interface StoreOrderStatus {
  slug: string;
  name: string;
}

export interface StoreStatusesResponse {
  status: string;
  data: { statuses: StoreOrderStatus[] };
}

export type StoreCodState =
  | "awaiting"
  | "confirmed"
  | "cancel_requested"
  | "cancelled"
  | "no_reply";

export interface StoreOrderMessage {
  /** A fixed kind, or `status_<slug>` for an extra status message. */
  kind: string;
  status: string;
  reason?: string | null;
  error?: string | null;
  templateName?: string | null;
  at?: string | null;
}

export interface StoreOrder {
  id: string;
  orderNumber: string;
  status: string;
  isCod: boolean;
  total?: string;
  currency?: string;
  customerName?: string | null;
  subscriberId?: string | null;
  placedAt?: string | null;
  updatedAt?: string | null;
  cod?: { state?: StoreCodState | null; respondedAt?: string | null } | null;
  messages: StoreOrderMessage[];
}

export interface StoreOrdersResponse {
  status: string;
  data: { page: number; limit: number; total: number; orders: StoreOrder[] };
}

export interface StoreCheckResponse {
  status: string;
  /** settingUp: asked while the store is still connecting. */
  data: { reachable: boolean; settingUp?: boolean; message?: string };
}

export interface StoreDisconnectResponse {
  status: string;
  data: { webhooksRemoved: boolean; hadAccessKey: boolean };
}

/** A one-time code that links the WordPress plugin (15 minutes). */
export interface StorePluginCodeResponse {
  status: string;
  data: { code: string; expiresAt: string };
}

export interface CreateCartTemplatePayload {
  language: string;
  /** Only when the text was changed; {{1}}-{{4}} only. */
  body?: string;
}

export interface CreateCartTemplateResponse {
  status: string;
  data: {
    outcome: "created" | "already_existed";
    templateName: string;
    language: string;
    status: string;
    category: string;
  };
}

export type StoreCartStatus = "open" | "converted" | "stopped" | "expired";

export interface StoreCartReminder {
  step: number;
  status: string;
  /** Why it wasn't sent, in plain words. */
  reason?: string | null;
  templateName?: string | null;
  at?: string | null;
}

export interface StoreCart {
  id: string;
  customerName?: string | null;
  subscriberId?: string | null;
  items: string;
  itemCount: number;
  total?: string | null;
  currency?: string | null;
  status: StoreCartStatus;
  /** Why reminders stopped, in plain words. */
  stopReason?: string | null;
  /** It became an order after a reminder went out. */
  recovered: boolean;
  orderNumber?: string | null;
  lastActivityAt?: string | null;
  nextReminderAt?: string | null;
  reminders: StoreCartReminder[];
}

export interface StoreCartsResponse {
  status: string;
  data: {
    page: number;
    limit: number;
    total: number;
    summary: {
      recoveredCount: number;
      recoveredTotals: { currency: string | null; amount: string }[];
    };
    carts: StoreCart[];
  };
}
