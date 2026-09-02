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
  };
  trends?: {
    totalContacts: AnalyticsTrend;
    conversations: AnalyticsTrend;
    messagesSent: AnalyticsTrend;
    deliveryRate: AnalyticsTrend;
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
