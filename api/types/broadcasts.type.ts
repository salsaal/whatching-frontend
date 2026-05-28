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
  mode: "all" | "tags" | "specific";
  tags?: string[];
  tagMatch?: "any" | "all";
  subscriberIds?: string[];
  optedInOnly?: boolean;
}

export interface BroadcastStats {
  totalRecipients: number;
  queuedRecipients: number;
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
  createdBy?: {
    _id: string;
    name: string;
    email: string;
  };
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
      subscriberId?: {
        _id: string;
        phoneNumber: string;
        firstName?: string;
        tags?: string[];
        isOptedIn?: boolean;
      };
    }>;
  };
}

export interface CreateBroadcastPayload {
  name: string;
  templateId: string;
  audience: BroadcastAudience;
  components: unknown[];
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
