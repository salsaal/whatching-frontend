import { BotSettings } from "./bot.type";

export type ConversationStatus = "open" | "pending" | "resolved";
export type ConversationPriority = "low" | "normal" | "high";
export type ConversationMode = "interactive" | "ai_fallback" | "agent_manual";
export type ConversationChannel = "whatsapp" | "instagram";
export type ManualTakeoverSource =
  | "dashboard"
  | "whatsapp_business_app"
  | "instagram_app"
  | "automation_handoff";
export type MessageDirection = "inbound" | "outbound" | "system";
export type MessageSource = "customer" | "agent" | "bot" | "system" | "broadcast";
export type MessageType =
  | "text"
  | "image"
  | "audio"
  | "document"
  | "video"
  | "template"
  | "interactive"
  | "location"
  | "system"
  | "unknown";

export interface ChatUser {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  phoneNumber?: string;
}

export interface ConversationSubscriber {
  _id: string;
  phoneNumber?: string;
  waId?: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  isOptedIn?: boolean;
  optInSource?: string;
  lastInteraction?: string;
  lastInboundAt?: string;
  lastOutboundAt?: string;
}

export interface ReplyWindow {
  isOpen: boolean;
  expiresAt: string | null;
  remainingMs: number;
}

export interface Conversation {
  _id: string;
  orgId: string;
  subscriberId: ConversationSubscriber;
  assignedTo?: ChatUser | null;
  manualTakeoverBy?: ChatUser | null;
  status: ConversationStatus;
  lastMessage?: string;
  lastMessageAt?: string;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  unreadCount: number;
  channel: ConversationChannel;
  priority: ConversationPriority;
  mode: ConversationMode;
  createdAt: string;
  updatedAt: string;
  replyWindow: ReplyWindow;
  botState?: {
    mode: ConversationMode;
    activeFlowId?: string | null;
    activeTriggerKey?: string | null;
    automationPausedUntil?: string | null;
    lastBotMessageId?: string | null;
  };
  takeoverState?: {
    handoffRequestedAt?: string | null;
    handoffReason?: string | null;
    manualTakeoverAt?: string | null;
    manualTakeoverSource?: ManualTakeoverSource | null;
    manualTakeoverBy?: ChatUser | null;
    lastAgentReplyAt?: string | null;
  };
}

export interface ChatMessage {
  _id: string;
  orgId: string;
  conversationId: string;
  subscriberId: string;
  direction: MessageDirection;
  source: MessageSource;
  senderUserId?: ChatUser | null;
  type: MessageType;
  templateId?: string;
  displayType: string;
  senderRole: "customer" | "agent" | "bot" | "system" | "broadcast";
  status: "queued" | "received" | "sent" | "delivered" | "read" | "failed";
  payload: {
    text?: string;
    caption?: string;
    mediaUrl?: string;
    filename?: string;
    mimeType?: string;
    location?: {
      latitude: number;
      longitude: number;
      name?: string;
      address?: string;
    };
    [key: string]: unknown;
  };
  attachment?: {
    mediaUrl: string | null;
    mimeType: string | null;
    filename: string | null;
    publicId: string | null;
    storageStatus: string | null;
  } | null;
  interactive?: {
    interactiveType: string | null;
    replyId: string | null;
    replyTitle: string | null;
  } | null;
  systemEvent?: {
    eventType: string | null;
    message: string | null;
  } | null;
  replyContext?: {
    messageId: string | null;
    metaMessageId: string | null;
  } | null;
  errorMessage?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatBootstrapResponse {
  status: string;
  data: {
    sidebar: {
      total: number;
      open: number;
      pending: number;
      resolved: number;
      unread: number;
    };
    currentUser: ChatUser;
    messaging: {
      metaStatus: string;
      phoneNumberId: string | null;
      displayPhoneNumber: string | null;
    };
    bot: {
      settings: BotSettings | null;
      defaultFlowReady: boolean;
      aiUsage?: Record<string, unknown>;
    };
  };
}

export interface ConversationListParams {
  page?: number;
  limit?: number;
  status?: ConversationStatus | "all";
  assignedTo?: string;
  priority?: ConversationPriority | "all";
  mode?: ConversationMode | "all";
  unreadOnly?: boolean;
  pendingEscalation?: boolean;
  search?: string;
}

export interface ConversationListResponse {
  status: string;
  results: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  data: {
    summary: {
      total: number;
      open: number;
      pending: number;
      resolved: number;
      unread: number;
      agentManual: number;
    };
    conversations: Conversation[];
  };
}

export interface ConversationResponse {
  status: string;
  data: {
    conversation: Conversation;
  };
}

export interface ConversationMessagesResponse {
  status: string;
  results: number;
  pagination: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
  data: {
    conversation: {
      id: string;
      unreadCount: number;
    };
    messages: ChatMessage[];
  };
}

export interface ConversationContextResponse {
  status: string;
  data: {
    conversation: Conversation;
    subscriber: ConversationSubscriber;
    mediaSummary: Array<{ _id: string; count: number }>;
  };
}

export interface SendConversationReplyPayload {
  text?: string;
  caption?: string;
  messageType?: "text" | "image" | "document" | "audio" | "video";
  mediaId?: string;
  attachment?: File | null;
  replyToMessageId?: string;
}

export interface SendConversationReplyResponse {
  status: string;
  message: string;
  data: {
    message: ChatMessage;
    conversationId: string;
    messageType: string;
  };
}

export type TemplateSendParameter = {
  type: string;
  text?: string;
  payload?: string;
  image?: { link: string };
  video?: { link: string };
  document?: { link: string };
  [key: string]: unknown;
};

export interface TemplateSendComponent {
  type: string;
  sub_type?: string;
  index?: number | string;
  parameters?: TemplateSendParameter[];
  [key: string]: unknown;
}

export interface SendTemplateMessagePayload {
  phoneNumber: string;
  countryIso?: string;
  templateName: string;
  languageCode?: string;
  components?: TemplateSendComponent[];
}

export interface SendTemplateMessageResponse {
  status: string;
  message: string;
  data: {
    message?: ChatMessage;
    messageId?: string;
    queueStatus: string;
    billingMode?: string;
  };
}
