export type AnalyticsRange = "7d" | "30d" | "90d";

export interface AnalyticsPoint {
  date: string;
  [key: string]: string | number;
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
  };
  messageActivity: AnalyticsPoint[];
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
