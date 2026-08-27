export type BroadcastStatus =
  | "draft"
  | "scheduled"
  | "processing"
  | "completed"
  | "failed"
  | "canceled"
  | string;

export interface BroadcastTemplateSummary {
  templateId: string;
  name: string;
  language: string;
  category: string;
}

export interface BroadcastAudience {
  mode: "all" | "tags" | "specific" | "campaign";
  tags?: string[];
  tagMatch?: "any" | "all";
  subscriberIds?: string[];
  campaignSourceIds?: string[];
  optedInOnly?: boolean;
}

export interface BroadcastStats {
  totalRecipients: number;
  queuedRecipients: number;
  deferredRecipients: number;
  sentRecipients: number;
  deliveredRecipients: number;
  readRecipients: number;
  failedRecipients: number;
  skippedRecipients: number;
  canceledRecipients: number;
}

export interface Broadcast {
  _id: string;
  orgId: string;
  name: string;
  status: BroadcastStatus;
  template: BroadcastTemplateSummary;
  audience: BroadcastAudience;
  payload: {
    components: unknown[];
  };
  stats: BroadcastStats;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  scheduledAt?: string | null;
  scheduledTimezone?: string | null;
  scheduledLocalTime?: string | null;
  lastError?: string;
  messagingLimitRetry?: {
    status: "awaiting_consent" | "scheduled" | "processing";
    detectedAt: string;
    eligibleAt: string;
    consentedAt?: string;
    scheduledAt?: string;
    attempt: number;
    lastFailureCode?: string;
    lastFailureMessage?: string;
  };
  createdBy?: {
    _id: string;
    name: string;
    email: string;
  };
  phoneNumberId?: string;
  wabaId?: string;
  whatsappPhoneNumberId?: string;
  whatsappPhoneNumberRecordId?: string;
  displayPhoneNumber?: string;
  messagingLimitTier?: string;
  whatsappSender?: {
    phoneNumberRecordId?: string;
    phoneNumberId: string;
    displayPhoneNumber?: string | null;
    verifiedName?: string | null;
  } | null;
}

export interface BroadcastsResponse {
  status: string;
  results: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  data: {
    broadcasts: Broadcast[];
  };
}

export interface BroadcastResponse {
  status: string;
  data: {
    broadcast: Broadcast;
    estimatedRecipients?: number | null;
    warnings?: string[];
    recipients?: Array<{
      _id: string;
      phoneNumber: string;
      status: string;
      queuedAt?: string;
      sentAt?: string;
      deliveredAt?: string;
      readAt?: string;
      metaMessageId?: string;
      errorCode?: string;
      errorMessage?: string;
      deferredAt?: string;
      failedAt?: string;
      subscriberId?: {
        _id: string;
        phoneNumber: string;
        firstName?: string;
        lastName?: string;
        tags?: string[];
        isOptedIn?: boolean;
      };
      messageId?: {
        _id: string;
        status: string;
        sentAt?: string;
        deliveredAt?: string;
        readAt?: string;
        metaMessageId?: string;
        failedAt?: string;
        errorCode?: string;
        errorMessage?: string;
      };
    }>;
    recipientsPagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export type BroadcastRecipient = NonNullable<
  BroadcastResponse["data"]["recipients"]
>[number];

export interface CreateBroadcastPayload {
  name: string;
  templateId: string;
  audience: BroadcastAudience;
  components: unknown[];
  phoneNumberId?: string;
  quickReplyRoutes?: Array<{
    index: number;
    label: string;
    triggerKey: string;
  }>;
}

export interface BroadcastListParams {
  page?: number;
  limit?: number;
  status?: string;
  q?: string;
  phoneNumberId?: string;
}

export interface StartBroadcastPayload {
  scheduledLocal?: string;
  timezone?: string;
}

export interface StartBroadcastResponse {
  status: string;
  message: string;
  data: {
    broadcastId: string;
    status: BroadcastStatus;
    scheduledAt: string | null;
    scheduledTimezone: string | null;
    scheduledLocalTime: string | null;
    warnings: string[];
  };
}

export interface BroadcastRetryResponse {
  status: string;
  message: string;
  data: {
    broadcastId: string;
    broadcastStatus: "paused_limit";
    retryStatus: "scheduled";
    retryAttempt: number;
    retryScheduledAt: string;
    consentedAt: string;
  };
}
