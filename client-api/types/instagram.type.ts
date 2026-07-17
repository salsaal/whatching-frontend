export type InstagramStatus = "pending" | "ready" | "disconnected" | string;

export interface InstagramConfig {
  pageId: string | null;
  igBusinessAccountId: string | null;
  status: InstagramStatus;
  connectedAt: string | null;
  webhookVerifiedAt: string | null;
  username: string | null;
  name?: string | null;
  biography?: string | null;
  website?: string | null;
  profilePictureUrl: string | null;
  followersCount?: number | null;
  followsCount?: number | null;
  mediaCount?: number | null;
  lastProfileSyncAt?: string | null;
  tokenExpiresAt: string | null;
  lastHealthCheckAt: string | null;
  activeAlerts: string[];
}

export interface InstagramStatusResponse {
  status: string;
  data: {
    instagram: InstagramConfig;
    enabledForPlan: boolean;
  };
}

export interface ConnectInstagramManualPayload {
  pageId: string;
  igBusinessAccountId: string;
  accessToken: string;
  username?: string;
}

export interface ConnectInstagramLoginPayload {
  code: string;
  redirectUri: string;
  pageId?: string;
  igBusinessAccountId?: string;
}

export interface InstagramLoginAccount {
  pageId: string;
  pageName?: string;
  igBusinessAccountId: string;
  username?: string;
  name?: string;
  profilePictureUrl?: string;
  followersCount?: number;
  mediaCount?: number;
}

export interface InstagramConnectResponse {
  status: string;
  data: {
    instagram: InstagramConfig;
    warnings?: Array<{ code: string; message: string }>;
  };
}

export interface InstagramMedia {
  _id: string;
  mediaId: string;
  caption?: string;
  mediaType?: string;
  mediaProductType?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  permalink?: string;
  timestamp?: string;
  commentsCount?: number;
  likeCount?: number;
  isCommentAutomationEligible?: boolean;
  eligibilityIssues?: string[];
  lastSyncedAt?: string;
}

export interface InstagramPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface InstagramMediaResponse {
  status: string;
  results: number;
  data: {
    media: InstagramMedia[];
    pagination: InstagramPagination;
  };
}

export type InstagramTriggerType =
  | "default"
  | "first_dm"
  | "keyword"
  | "story_reply"
  | "comment_private_reply_opened"
  | "manual_start";

export type InstagramBlockType =
  | "send_text"
  | "send_image"
  | "send_video"
  | "quick_replies"
  | "button_template"
  | "generic_template"
  | "tag_subscriber"
  | "handoff_to_agent"
  | "pause_automation"
  | "end_flow";

export type InstagramActionType =
  | "go_to_node"
  | "handoff_to_agent"
  | "pause_automation"
  | "end_flow"
  | "tag_subscriber"
  | "open_url";

export interface InstagramCanvasAction {
  actionId: string;
  type: InstagramActionType;
  label?: string;
  replyId?: string;
  nextNodeId?: string;
  nextTriggerKey?: string;
  url?: string;
  tags?: string[];
  pauseMinutes?: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface InstagramQuickReply {
  replyId?: string;
  payload?: string;
  label?: string;
  title?: string;
  contentType?: "text" | "user_phone_number" | "user_email";
}

export interface InstagramTemplateButton {
  actionId?: string;
  type?: "postback" | "web_url";
  label?: string;
  title?: string;
  replyId?: string;
  payload?: string;
  url?: string;
}

export interface InstagramGenericCard {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  image_url?: string;
  mediaId?: string;
  mediaName?: string;
  mediaType?: "image" | "video";
  defaultActionUrl?: string;
  buttons?: InstagramTemplateButton[];
}

export interface InstagramCanvasContent {
  text?: string;
  mediaId?: string;
  mediaName?: string;
  quickReplies?: InstagramQuickReply[];
  buttons?: InstagramTemplateButton[];
  cards?: InstagramGenericCard[];
  tags?: string[];
  minutes?: number;
  pauseMinutes?: number;
  reason?: string;
  [key: string]: unknown;
}

export interface InstagramCanvasNode {
  id: string;
  type?: "instagramBlock" | string;
  position?: { x: number; y: number };
  data?: {
    id?: string;
    name?: string;
    label?: string;
    triggerType?: InstagramTriggerType;
    triggerKey?: string;
    blockType?: InstagramBlockType;
    content?: InstagramCanvasContent;
    actions?: InstagramCanvasAction[];
    locked?: boolean;
    metadata?: Record<string, unknown>;
  };
  triggerType?: InstagramTriggerType;
  triggerKey?: string;
  name?: string;
  blockType?: InstagramBlockType;
  content?: InstagramCanvasContent;
  actions?: InstagramCanvasAction[];
  locked?: boolean;
  metadata?: Record<string, unknown>;
}

export interface InstagramCanvasEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  actionId?: string;
  replyId?: string;
  data?: Record<string, unknown>;
}

export interface InstagramCanvasState {
  version: number;
  defaultTriggerKey?: string;
  nodes: InstagramCanvasNode[];
  edges: InstagramCanvasEdge[];
  viewport?: { x: number; y: number; zoom: number };
  updatedAt?: string;
  updatedBy?: string;
}

export type InstagramCanvasStatus = "active" | "inactive" | "archived";

export interface InstagramCanvasRecord {
  _id: string;
  orgId?: string;
  name: string;
  status: InstagramCanvasStatus;
  latestDraftVersionId?: string;
  latestPublishedVersionId?: string;
  activePublishedVersionId?: string;
  draftState?: InstagramCanvasState;
  publishedState?: InstagramCanvasState | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface InstagramCanvasVersion {
  _id: string;
  canvasId: string;
  type: "draft" | "published";
  versionNumber: number;
  state?: InstagramCanvasState;
  publishedState?: InstagramCanvasState;
  createdAt?: string;
  updatedAt?: string;
}

export interface InstagramCanvasesResponse {
  status: string;
  results: number;
  data: {
    canvases: InstagramCanvasRecord[];
  };
}

export interface InstagramCanvasDetailResponse {
  status: string;
  data: {
    canvas: InstagramCanvasRecord;
    draftVersion?: InstagramCanvasVersion | null;
    latestPublishedVersion?: InstagramCanvasVersion | null;
  };
}

export interface InstagramCanvasResponse {
  status: string;
  data: {
    canvasId: string;
    draftState?: InstagramCanvasState;
    publishedState?: InstagramCanvasState | null;
    updatedAt: string;
  };
}

export interface InstagramCanvasValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    nodeCount: number;
    edgeCount: number;
    triggerCount: number;
    replyRouteCount: number;
  };
}

export interface InstagramCanvasValidationResponse {
  status: string;
  data: {
    validation: InstagramCanvasValidation;
  };
}

export interface InstagramCanvasPublishResponse {
  status: string;
  data: {
    canvasId: string;
    publishedState: InstagramCanvasState;
    validation: InstagramCanvasValidation;
  };
}

export type InstagramFlowStatus = "draft" | "published" | "archived";

export interface InstagramFlow {
  _id: string;
  name: string;
  triggerType: Exclude<InstagramTriggerType, "default">;
  triggerKey?: string;
  status: InstagramFlowStatus;
  blocks: Record<string, unknown>[];
  actions: Record<string, unknown>[];
  version: number;
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InstagramFlowsResponse {
  status: string;
  results: number;
  data: {
    flows: InstagramFlow[];
    pagination: InstagramPagination;
  };
}

export interface InstagramCommentRule {
  _id: string;
  name: string;
  status: "draft" | "enabled" | "disabled" | "archived";
  scope: "all_media" | "specific_media";
  mediaIds: string[];
  media?: InstagramMedia[];
  keywordMode: "any" | "all";
  keywords: string[];
  publicReplyText?: string;
  privateReplyText?: string;
  sendPublicReply: boolean;
  sendPrivateReply: boolean;
  cooldownSeconds: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface InstagramCommentRulePayload {
  name: string;
  status?: "draft" | "enabled" | "disabled" | "archived";
  scope?: "all_media" | "specific_media";
  mediaIds?: string[];
  keywordMode?: "any" | "all";
  keywords?: string[];
  publicReplyText?: string;
  privateReplyText?: string;
  sendPublicReply?: boolean;
  sendPrivateReply?: boolean;
  cooldownSeconds?: number;
}

export interface InstagramCommentRulesResponse {
  status: string;
  results: number;
  data: {
    rules: InstagramCommentRule[];
    pagination: InstagramPagination;
  };
}

export interface InstagramCommentRuleResponse {
  status: string;
  data: {
    rule: InstagramCommentRule;
  };
}

export interface InstagramAutomationLog {
  _id: string;
  ruleId?: string;
  flowId?: string;
  subscriberId?: string;
  conversationId?: string;
  instagramUserId?: string;
  mediaId?: string;
  commentId?: string;
  messageId?: string;
  action: string;
  status: "success" | "failed" | "skipped";
  providerResponse?: Record<string, unknown>;
  error?: string;
  dedupeKey: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InstagramAutomationLogsResponse {
  status: string;
  results: number;
  data: {
    logs: InstagramAutomationLog[];
    pagination: InstagramPagination;
  };
}
