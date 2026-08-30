import { IntegrationStatus, Organization } from "@/stores/organizationStore";

export type WhatsAppPhoneNumberStatus =
  | "active"
  | "inactive"
  | "plan_locked"
  | "archived";

export interface WhatsAppPhoneNumber {
  _id: string;
  id: string;
  orgId: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  businessAccountName?: string;
  status: WhatsAppPhoneNumberStatus;
  connectionStatus: "pending" | "ready" | "disconnected";
  isDefault: boolean;
  qualityRating?: string;
  qualityStatus?: string;
  messagingLimitTier?: string;
  messagingLimitCount?: number;
  messagingLimitScope?: "business_portfolio";
  clientBusinessId?: string;
  activeCanvasId?: string;
  coexistenceEnabled?: boolean;
  coexistenceStatus?: "not_enabled" | "enabled" | "disconnected" | "limited";
  coexistenceContactSync?: CoexistenceContactSyncState;
  coexistenceContactSyncRequestId?: string;
  coexistenceContactSyncStatus?: CoexistenceContactSyncState["status"];
  coexistenceContactSyncRequestAttempts?: number;
  coexistenceContactSyncLastReceivedAt?: string;
  coexistenceContactSyncLastProcessedAt?: string;
  coexistenceContactSyncLastError?: string;
  coexistenceContactsAdded?: number;
  coexistenceContactsRemoved?: number;
  coexistenceContactsSkipped?: number;
  lastHealthCheckAt?: string;
  connectedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  outboundReadiness?: WhatsAppOutboundReadinessState;
  activeAlerts?: Array<{
    code: string;
    severity: "info" | "warning" | "critical";
    message: string;
    createdAt?: string;
    lastTriggeredAt?: string;
  }>;
}

export type WhatsAppOutboundReadinessStatus =
  | "not_tested"
  | "template_pending"
  | "testing"
  | "ready"
  | "failed"
  | "inconclusive";

export interface WhatsAppOutboundReadinessState {
  status: WhatsAppOutboundReadinessStatus;
  templateName?: string;
  templateLanguage?: string;
  providerStatus?: "sent" | "delivered" | "read" | "failed";
  providerStatusAt?: string;
  requestedAt?: string;
  verifiedAt?: string;
  failedAt?: string;
  failureCategory?: string;
  failureCode?: string;
  failureMessage?: string;
}

export interface WhatsAppOutboundReadinessResponse {
  status: string;
  message?: string;
  data: {
    phoneNumberId: string;
    senderPhoneNumberId: string;
    readiness: WhatsAppOutboundReadinessState;
    canStartBroadcast?: boolean;
    blocker?: {
      code: string;
      statusCode: number;
      message: string;
      details?: Record<string, unknown> & { paymentSetupUrl?: string };
    } | null;
  };
}

export interface CoexistenceContactSyncState {
  requestId: string | null;
  status:
    | "not_requested"
    | "requesting"
    | "requested"
    | "processing"
    | "active"
    | "failed";
  lastReceivedAt: string | null;
  lastProcessedAt: string | null;
  lastError: string | null;
  contactsActive: number;
  contactsRemoved: number;
  contactsSkipped: number;
  recoveredContactChanges: number;
  warning: string | null;
  maxAttempts: number;
  attemptsUsed: number;
  attemptsRemaining: number;
  subscriberLimit?: number;
  subscribersUsed?: number;
  subscriberSlotsAvailable?: number | null;
}

export interface WhatsAppPhoneNumberSummary {
  planLimit: number | null;
  activeCount: number;
  remainingActiveSlots: number | null;
  phoneNumbers: WhatsAppPhoneNumber[];
}

export interface WhatsAppPhoneNumbersResponse {
  status: string;
  results?: number;
  data: WhatsAppPhoneNumberSummary & {
    syncedPhoneNumbers?: WhatsAppPhoneNumber[];
  };
}

export interface WhatsAppPhoneNumberResponse {
  status: string;
  data: {
    phoneNumber: WhatsAppPhoneNumber;
    summary?: WhatsAppPhoneNumberSummary;
  };
}

export interface CoexistenceContactSyncResponse {
  status: string;
  message: string;
  data: {
    contactSync: CoexistenceContactSyncState;
    phoneNumber: WhatsAppPhoneNumber;
    whatsAppPhoneNumbers: WhatsAppPhoneNumberSummary;
  };
}

export interface RequestCoexistenceContactSyncPayload {
  phoneNumberRecordId?: string;
  phoneNumberId?: string;
}

export interface OrganizationsResponse {
  status: string;
  results: number;
  data: {
    organizations: Organization[];
  };
}

export interface OrganizationResponse {
  status: string;
  data: {
    organization: Organization;
    subscribedAppsWarning?: string | null;
  };
}

export interface DeleteOrganizationResponse {
  status: string;
  message: string;
  data: {
    deletedOrganizationId: string;
    deletedCounts?: Record<string, number>;
    cloudinaryCleanup?: unknown;
  };
}

export interface IntegrationStatusResponse {
  status: string;
  data: {
    integration: IntegrationStatus;
  };
}

export interface ConnectMetaPayload {
  wabaId: string;
  phoneNumberId: string;
  accessToken?: string;
  code?: string;
  coexistenceEnabled?: boolean;
}

export interface EmbeddedSignupConnectPayload {
  code: string;
  wabaId: string;
  phoneNumberId: string;
  waba_id?: string;
  phone_number_id?: string;
  whatsappBusinessAccountId?: string;
  businessPhoneNumberId?: string;
  businessId?: string;
  business_id?: string;
  event?: string;
  sessionEvent?: string;
  signupEvent?: string;
  authResponse?: {
    code?: string;
    [key: string]: unknown;
  };
  data?: {
    waba_id?: string;
    wabaId?: string;
    phone_number_id?: string;
    phoneNumberId?: string;
    business_id?: string;
    event?: string;
    [key: string]: unknown;
  };
  coexistenceEnabled?: boolean;
}

export interface SubscribeResponse {
  status: string;
  message?: string;
  data: {
    subscriptionId?: string;
    paymentUrl?: string;
    key?: string;
    subscriptionStatus?: string;
    organization?: Organization;
    synced?: boolean;
  };
}

export interface BillingProfile {
  country?: "IN";
  legalName: string;
  billingEmail: string;
  address: string;
  state: string;
  pinCode: string;
  gstin?: string;
}

export interface BillingProfileResponse {
  status: string;
  message?: string;
  data: {
    billingProfile: BillingProfile | null;
    complete: boolean;
  };
}

export interface BillingTransaction {
  _id: string;
  orgId: string;
  amount: number;
  type: string;
  status: string;
  description: string;
  referenceId?: string;
  createdAt: string;
  updatedAt: string;
  __v?: number;
}

export interface BillingHistoryResponse {
  status: string;
  data: {
    transactions: BillingTransaction[];
  };
}

export interface CancelSubscriptionResponse {
  status: string;
  message: string;
  data?: {
    organization?: Organization;
    currentPeriodEnd?: string | null;
    accessUntil?: string | null;
  };
}

export interface SyncSubscriptionResponse {
  status: string;
  data: {
    organization: Organization;
    remoteSubscription?: unknown;
    synced: boolean;
  };
}

export interface ResumeSubscriptionResponse {
  status: string;
  message: string;
  data: {
    resumed: boolean;
    requiresAuthorization: boolean;
    subscriptionId: string;
    replacementSubscriptionId: string;
    paymentUrl: string | null;
    key: string;
    planTier: "basic" | "pro";
    effectiveAt: string;
    organization: Organization;
  };
}

export interface ChangePlanResponse {
  status: string;
  message?: string;
  data?: {
    organization?: Organization;
    subscriptionId?: string;
    replacementSubscriptionId?: string;
    key?: string;
    paymentUrl?: string;
    [key: string]: unknown;
  };
}

export interface StartTrialResponse {
  status: string;
  message: string;
  data: {
    organization: Organization;
    trial?: {
      active: boolean;
      tier: "basic" | "pro";
      startedAt: string;
      endsAt: string;
      days: number;
      creditCardRequired?: boolean;
    };
  };
}

export type SupportRequestCategory =
  | "billing"
  | "integration"
  | "contact_sync"
  | "data_recovery"
  | "plan_limit"
  | "technical"
  | "other";
export type SupportRequestPriority = "low" | "normal" | "high" | "urgent";
export type SupportRequestStatus =
  | "open"
  | "in_review"
  | "resolved"
  | "archived";

export interface SupportRequest {
  _id: string;
  category: SupportRequestCategory;
  priority: SupportRequestPriority;
  status: SupportRequestStatus;
  subject: string;
  message: string;
  images?: Array<{
    url: string;
    name: string;
    mimeType?: string;
    fileSize?: number;
  }>;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface SupportRequestsResponse {
  status: string;
  results: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  data: { supportRequests: SupportRequest[] };
}

export interface SupportRequestResponse {
  status: string;
  message?: string;
  data: { supportRequest: SupportRequest };
}

export interface CreateSupportRequestPayload {
  category?: SupportRequestCategory;
  priority?: SupportRequestPriority;
  subject: string;
  message: string;
  context?: Record<string, unknown>;
  images?: File[];
}

export interface TeamMember {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    phoneNumber?: string;
  };
  orgId: string;
  role: "owner" | "admin" | "agent" | string;
  status: "active" | "invited" | "disabled" | string;
  permissionGrants?: string[];
  effectivePermissionGrants?: string[];
  permissionAccess?: PermissionAccessState;
  effectivePermissionAccess?: PermissionAccessState;
  createdAt: string;
  updatedAt: string;
}

export type PermissionAccessLevel = "none" | "view" | "reply" | "manage";

export interface PermissionLevelDefinition {
  value: PermissionAccessLevel;
  label: string;
  grants?: string[];
}

export interface PermissionCapability {
  key: string;
  label: string;
  permission: string;
}

export interface PermissionAccessStateEntry {
  access: PermissionAccessLevel;
  capabilities: Record<string, boolean>;
}

export type PermissionAccessState = Record<string, PermissionAccessStateEntry>;

export interface PermissionGroup {
  key: string;
  label: string;
  description?: string;
  accessControl?: {
    type: "level";
    permissionKeys?: string[];
    levels?: PermissionLevelDefinition[];
  };
  capabilities?: PermissionCapability[];
}

export interface TeamResponse {
  status: string;
  results: number;
  data: {
    team: TeamMember[];
    permissionSchema?: PermissionGroup[];
    defaultAgentPermissionAccess?: PermissionAccessState;
  };
}

export interface AddAgentPayload {
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
  countryIso?: string;
  permissionAccess?: PermissionAccessState;
}

export interface AddAgentResponse {
  status: string;
  message?: string;
  data?: {
    agent?: {
      id: string;
      name: string;
      email: string;
      phoneNumber: string;
    };
  };
}

export interface InvoicePartySnapshot {
  legalName: string;
  address: string;
  state: string;
  pinCode?: string;
  gstin?: string;
  email?: string;
}

export interface Invoice {
  _id: string;
  orgId: string;
  invoiceNumber: string;
  financialYear: string;
  source: "subscription_payment" | "wallet_topup" | "ai_token_topup";
  provider: "razorpay";
  status: "pending" | "sent" | "failed";
  invoiceDate: string;
  paidAt: string;
  amountTotalPaise: number;
  taxableAmountPaise: number;
  gstAmountPaise: number;
  cgstAmountPaise: number;
  sgstAmountPaise: number;
  igstAmountPaise: number;
  taxMode: "cgst_sgst" | "igst";
  pricingMode: "inclusive" | "exclusive";
  gstRate: number;
  description: string;
  seller: InvoicePartySnapshot;
  buyer: InvoicePartySnapshot;
  emailSentAt?: string;
  attemptCount: number;
  lastError?: string;
  pdfAvailable: boolean;
}

export interface InvoicesResponse {
  status: string;
  data: {
    invoices: Invoice[];
  };
}

export interface RetryInvoiceResponse {
  status: string;
  message: string;
}

export interface AiTokenPackage {
  packageId: "1m" | "3m" | "5m" | "10m";
  label: string;
  tokens: number;
  baseAmountPaise: number;
  gstRate: number;
  gstAmountPaise: number;
  amountPaise: number;
  currency: "INR";
  pricingMode: "exclusive";
}

export interface AiTokenPackagesResponse {
  status: string;
  data: {
    packages: AiTokenPackage[];
  };
}

export interface AiTokenUsage {
  used: number;
  reserved: number;
  purchased: number;
  committed: number;
  includedRemaining: number;
  topUpRemaining: number;
  remaining: number;
  cycleStartedAt: string | null;
  cycleResetsAt: string | null;
}

export interface AiTokenUsageResponse {
  status: string;
  data: {
    usage: AiTokenUsage | null;
    includedLimit: number;
    planTier: string;
  };
}

export interface AiTokenTopupResponse {
  status: string;
  message: string;
  data: {
    packageId: string;
    label: string;
    tokens: number;
    baseAmountPaise: number;
    gstAmountPaise: number;
    amountPaise: number;
    currency: "INR";
    pricingMode: "exclusive";
    orderId: string;
    referenceId: string;
    key: string;
    prefill: {
      name?: string;
      email?: string;
      contact?: string;
    };
  };
}

export interface VerifyAiTokenTopupPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface VerifyAiTokenTopupResponse {
  status: string;
  message: string;
  data: {
    usage: AiTokenUsage | null;
    includedLimit: number;
  };
}
