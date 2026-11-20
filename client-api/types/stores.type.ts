// Store connections (WooCommerce order messages). Shapes follow the
// backend's /organizations/stores routes; see docs/STORE_FRONTEND_SPEC.md
// in the backend repo.

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

export interface StoreSettings {
  senderPhoneNumberId?: string;
  shippedStatuses?: string[];
  messages?: Partial<Record<StoreFixedMessageKind, StoreMessageSetting>>;
  customStatusRules?: StoreCustomStatusRule[];
  cod?: { autoCancel?: boolean; paymentMethods?: string[] };
}

export interface StoreConnection {
  id: string;
  platform: "woocommerce";
  status: StoreConnectionStatus;
  storeUrl: string;
  storeName: string;
  connectedAt?: string | null;
  lastSyncAt?: string | null;
  lastWebhookAt?: string | null;
  attention?: {
    reason?: "access_removed" | "unreachable" | string | null;
    message?: string | null;
  } | null;
  setupFailure?: { message: string } | null;
  disconnectedAt?: string | null;
  settings?: StoreSettings;
}

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

export interface StoreResponse {
  status: string;
  data: {
    enabledForPlan: boolean;
    connection: StoreConnection | null;
    /** Per message type, plus `custom_status` for extra status messages. */
    templateVariables: Record<string, StoreTemplateVariable[]>;
    readyMadeTemplates: ReadyMadeStoreTemplate[];
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
