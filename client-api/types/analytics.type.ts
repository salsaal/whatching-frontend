export type AnalyticsRange = "7d" | "30d" | "90d";

export interface AnalyticsPoint {
  date: string;
  [key: string]: string | number;
}

export interface AnalyticsTrend {
  current: number;
  previous: number;
  changePercent: number;
}

export interface DashboardAnalytics {
  generatedAt: string;
  range: {
    key: AnalyticsRange;
    days: number;
    from: string;
    to: string;
    timezone: string;
  };
  cards: {
    totalContacts: number;
    conversations: number;
    messagesSent: number;
    messagesReceived: number;
    unreadMessages: number;
    unreadConversations: number;
    deliveryRate: number;
    /** Conversations with at least one message in the period. */
    activeConversations?: number;
    /** Conversations started in the period. */
    newConversations?: number;
  };
  trends?: {
    totalContacts: AnalyticsTrend;
    /** All-time total against the total when the period started. */
    conversations: AnalyticsTrend;
    messagesSent: AnalyticsTrend;
    deliveryRate: AnalyticsTrend;
    /** Against the previous period of the same length. */
    activeConversations?: AnalyticsTrend;
    newConversations?: AnalyticsTrend;
  };
  messageActivity: AnalyticsPoint[];
  deliveryRateSeries: Array<{ date: string; rate: number | null }>;
  conversationStatus: {
    open: number;
    pending: number;
    resolved: number;
  };
  messageSources: {
    bot: number;
    agent: number;
    broadcast: number;
  };
  channelDistribution: {
    whatsapp: number;
    instagram: number;
  };
  contactGrowth: AnalyticsPoint[];
  contactChannels: {
    whatsapp: number;
    instagram: number;
  };
  broadcastPerformance: {
    totalRecipients: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    sendRate: number;
    deliveryRate: number;
    readRate: number;
    failureRate: number;
  };
  recentBroadcasts: Array<{
    id: string;
    name: string;
    status: string;
    templateName: string | null;
    displayPhoneNumber: string | null;
    createdAt: string;
    stats: {
      totalRecipients: number;
      sent: number;
      delivered: number;
      read: number;
      failed: number;
      deliveryRate: number;
      readRate: number;
    };
  }>;
  integrationHealth: {
    whatsapp: {
      status: string;
      activePhoneNumbers: number;
      messagingLimit?: {
        tier: string | null;
        limit: number | null;
        isUnlimited: boolean;
      };
      phoneNumbers?: Array<{
        id: string;
        displayPhoneNumber: string | null;
        isDefault: boolean;
        qualityRating: string | null;
        lastHealthCheckAt: string | null;
      }>;
    };
    instagram: {
      status: string;
      username: string | null;
      followersCount: number;
    };
    alerts: Array<{
      code?: string;
      severity?: string;
      message?: string;
      source?: string;
      displayPhoneNumber?: string | null;
    }>;
  };
}

export interface DashboardAnalyticsResponse {
  status: string;
  data: {
    dashboard: DashboardAnalytics;
  };
}

export type ConversationCostGroupBy = "category" | "type" | "country" | "phone";

export interface ConversationCostBreakdownRow {
  key: string;
  conversationCount: number;
  cost: number;
}

export interface ConversationCostDailyPoint {
  date: string;
  conversationCount: number;
  cost: number;
}

export interface ConversationCostResponse {
  status: string;
  data: {
    range: { start: string; end: string };
    groupBy: ConversationCostGroupBy;
    currency: string | null;
    lastSyncedDate: string | null;
    // Always false -- a permanent Meta policy constraint for accounts billed
    // through a partner, not a sync-timing issue. conversationCount/volume
    // fields stay real; every cost/amountSpent field is always 0 when this
    // is false, never a genuine figure.
    costDataAvailable: boolean;
    totals: {
      conversationCount: number;
      cost: number;
      costPerConversation: number;
    };
    previousPeriod: {
      conversationCount: number;
      cost: number;
      costPerConversation: number;
    };
    billable: { conversationCount: number; cost: number };
    freeTier: { conversationCount: number; cost: number };
    daily: ConversationCostDailyPoint[];
    breakdown: ConversationCostBreakdownRow[];
  };
}

/**
 * WhatsApp's 1,000 free customer replies per number per month. `ok` below
 * 800 used; `nearly_used` from 800; `used_up` at 1,000 or once any reply
 * was charged.
 */
export type FreeReplyState = "ok" | "nearly_used" | "used_up";

export interface FreeReplyNumber {
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  freeRepliesUsed: number;
  freeRepliesLeft: number;
  chargedReplies: number;
  state: FreeReplyState;
}

export interface FreeRepliesResponse {
  status: string;
  data: {
    /** "2026-11" */
    month: string;
    /** "2026-12-01", the day the allowance starts again. */
    resetsOn: string;
    freeRepliesPerMonth: number;
    /** Null until the first refresh (every 6 hours). */
    lastUpdatedAt: string | null;
    numbers: FreeReplyNumber[];
  };
}

export interface TemplateAnalyticsClick {
  type: string;
  buttonContent?: string;
  count: number;
}

export interface TemplateAnalyticsRow {
  templateId: string;
  name: string | null;
  language: string | null;
  category: string | null;
  qualityScore: string | null;
  sent: number;
  delivered: number;
  read: number;
  amountSpent: number;
  clicks: TemplateAnalyticsClick[];
}

export interface TemplateAnalyticsResponse {
  status: string;
  data: {
    range: { start: string; end: string };
    templates: TemplateAnalyticsRow[];
    // Same permanent constraint as ConversationCostResponse -- always false;
    // template.amountSpent is always 0 when this is false.
    costDataAvailable: boolean;
  };
}

export interface TemplateInsightsStatusResponse {
  status: string;
  data: {
    wabaId: string;
    templateInsightsEnabled: boolean;
  };
}

export interface TemplateInsightsEnableResponse {
  status: string;
  data: {
    wabaId: string;
    [key: string]: unknown;
  };
}
