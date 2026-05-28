export interface Subscriber {
  _id: string;
  orgId: string;
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  tags: string[];
  isOptedIn: boolean;
  lastInteraction?: string;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  optInSource?: string;
  waId?: string;
  createdAt: string;
  updatedAt: string;
  __v?: number;
}

export interface ConversationSummary {
  _id: string;
  lastMessage?: string;
  status: string;
  unreadCount: number;
  assignedTo?: string;
  priority: string;
  lastInboundAt?: string;
  lastMessageAt?: string;
  lastOutboundAt?: string;
  replyWindow?: {
    isOpen: boolean;
    expiresAt?: string;
    remainingMs?: number;
  };
}

export interface SubscribersResponse {
  status: string;
  results: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  data: {
    subscribers: Subscriber[];
  };
}

export interface SubscriberResponse {
  status: string;
  data: {
    subscriber: Subscriber;
    conversation?: ConversationSummary;
  };
}

export interface SubscriberPayload {
  phoneNumber: string;
  firstName: string;
  lastName?: string;
  tags?: string[];
}

export interface ImportSubscribersPayload {
  dryRun: boolean;
  subscribers: SubscriberPayload[];
}

export interface ImportSubscribersResponse {
  status: string;
  message: string;
  data: {
    summary: {
      totalRows: number;
      validRows: number;
      newSubscribers: number;
      updatedSubscribers: number;
      skippedRows: unknown[];
      dryRun: boolean;
      currentSubscriberCount: number;
    };
  };
}

export interface TagsResponse {
  status: string;
  data: {
    tags: string[];
  };
}

export interface BulkDeleteSubscribersResponse {
  status: string;
  message: string;
  data: {
    deletedCount: number;
  };
}
