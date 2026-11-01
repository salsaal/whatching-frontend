import { ApiResponse } from "./api";

export type BotBlockType =
  | "text"
  | "buttons"
  | "list"
  | "image"
  | "document"
  | "video"
  | "location"
  | "location_request"
  | "address_request"
  | "contacts"
  | "handoff_to_agent"
  | "product_carousel"
  | "generic_carousel";

export type BotActionType =
  | "go_to_trigger"
  | "escalate_to_agent"
  | "end_conversation"
  | "open_url";

export interface BotAction {
  actionId: string;
  type: BotActionType;
  label?: string;
  replyId?: string;
  nextTriggerKey?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface BotCanvasNodeContent {
  text?: string;
  bodyText?: string;
  buttonText?: string;
  footerText?: string;
  mediaId?: string;
  mediaName?: string;
  mediaType?: "image" | "document" | "video";
  latitude?: number;
  longitude?: number;
  locationName?: string;
  locationAddress?: string;
  catalogId?: string;
  sections?: Array<Record<string, unknown>>;
  cards?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface BotCanvasNode {
  id: string;
  triggerKey: string;
  name: string;
  blockType: BotBlockType;
  sortOrder?: number;
  content: BotCanvasNodeContent;
  actions: BotAction[];
  position?: {
    x: number;
    y: number;
  };
  followUp?: {
    enabled: true;
    delayMinutes: number;
    targetTriggerKey: string;
  };
  metadata?: Record<string, unknown>;
}

export interface BotCanvasEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  actionId?: string;
  replyId?: string;
  metadata?: Record<string, unknown>;
}

export interface BotCanvasDraftState {
  version: number;
  defaultTriggerKey?: string;
  nodes: BotCanvasNode[];
  edges: BotCanvasEdge[];
  updatedAt?: string;
  publishedAt?: string;
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

export interface BotCanvasRecord {
  _id: string;
  /** Bumps on every draft write; send it back as baseRevision. */
  draftRevision?: number;
  orgId: string;
  name: string;
  status: "active" | "inactive" | "archived";
  draftState?: BotCanvasDraftState;
  publishedState?: BotCanvasDraftState | null;
  latestDraftVersionId?: string;
  latestPublishedVersionId?: string;
  activePublishedVersionId?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** What differs between the draft and the live version (layout moves don't count). */
export interface BotDraftChanges {
  neverPublished: boolean;
  hasUnpublishedChanges: boolean;
  changedBlockCount: number;
  addedBlockIds: string[];
  removedBlockIds: string[];
  changedBlockIds: string[];
  startChanged: boolean;
}

export interface BotCanvasLiveInfo {
  hasLiveVersion: boolean;
  /** Answers numbers that have no flow of their own. */
  isOrgDefault: boolean;
  phoneNumbers: Array<{
    _id: string;
    displayPhoneNumber?: string;
    verifiedName?: string;
    source: "assigned" | "org_default";
  }>;
  botEnabled: boolean;
}

export type BotFlowIssueSeverity = "error" | "warning";

/** One problem found by the backend; `message` is shown as-is. */
export interface BotFlowIssue {
  severity: BotFlowIssueSeverity;
  code: string;
  message: string;
  nodeId?: string;
  blockName?: string;
  /** Which option the problem is about. */
  actionId?: string;
  /** e.g. "content.cards.2.bodyText", "content.sections.0.rows.3.title", "followUp". */
  field?: string;
}

export type BotFlowEntryPoint =
  | { kind: "start" | "opt_in" | "opt_out" | "ai" }
  | {
      kind: "option";
      fromNodeId: string;
      fromBlockName: string;
      label?: string;
    }
  | {
      kind: "follow_up";
      fromNodeId: string;
      fromBlockName: string;
      delayMinutes: number;
    }
  | { kind: "template"; templateName: string; label: string }
  | { kind: "broadcast"; broadcastName: string; label: string };

export interface BotCanvasValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  issues: BotFlowIssue[];
  analysis?: Record<
    string,
    { reachable: boolean; entryPoints: BotFlowEntryPoint[] }
  >;
}

/** details of a 409 DRAFT_CONFLICT: someone saved after you loaded. */
export interface BotDraftConflictDetails {
  draftRevision: number;
  updatedAt?: string;
  updatedBy?: { _id: string; name: string } | null;
}

export interface BotCanvasTrigger {
  triggerKey: string;
  nodeId: string;
  name: string;
  blockType: BotBlockType;
}

export interface BotCanvasTriggerSummary {
  canvasId: string | null;
  source?: "phone_number" | "organization_default" | string;
  phoneNumber?: {
    id?: string;
    phoneNumberId?: string;
    displayPhoneNumber?: string;
  } | null;
  updatedAt?: string | null;
  defaultTriggerKey: string | null;
  triggerKeys: string[];
  triggers: BotCanvasTrigger[];
}

export interface BotSettings {
  isBotEnabled: boolean;
  isAiEnabled: boolean;
  systemPrompt?: string;
  defaultTriggerKey?: string;
  greetingKeywords?: string[];
  optInKeywords?: string[];
  optOutKeywords?: string[];
  escalationTriggerIds?: string[];
  autoTimeoutMinutes?: number;
  geminiModel?: string;
  spamProtectionEnabled: boolean;
  spamFloodThreshold: number;
  spamFloodWindowSeconds: number;
  /** Sent to the customer when a chat is handed to the team. */
  handoffMessage?: string;
}

export type BotSettingsPatch = Partial<
  Pick<
    BotSettings,
    | "isBotEnabled"
    | "isAiEnabled"
    | "greetingKeywords"
    | "optInKeywords"
    | "optOutKeywords"
    | "escalationTriggerIds"
    | "spamProtectionEnabled"
    | "spamFloodThreshold"
    | "spamFloodWindowSeconds"
    | "handoffMessage"
  >
>;

export interface KnowledgeSource {
  _id: string;
  type: "text" | "faq" | "file";
  status: "pending" | "processing" | "ready" | "failed" | "archived";
  title: string;
  content?: string;
  faqEntries?: Array<{ question: string; answer: string }>;
  filename?: string;
  mimeType?: string;
  cloudinaryUrl?: string;
  publicId?: string;
  ingestError?: string;
  chunkCount?: number;
  lastIngestedAt?: string;
  disabledAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeChunk {
  _id: string;
  order: number;
  content: string;
  tokenEstimate: number;
  disabledAt?: string | null;
}

export interface KnowledgeSearchResult {
  id: string;
  sourceId: string;
  sourceTitle: string | null;
  heading: string | null;
  /** Reciprocal-rank-fusion score: only meaningful relative to the others. */
  score: number;
  excerpt: string;
}

export type KnowledgeSearchTestResponse = ApiResponse<{
  chunks: KnowledgeSearchResult[];
}>;

export interface BotStatus {
  botEnabled: boolean;
  aiEnabled: boolean;
  defaultFlowReady: boolean;
  optOutFlowReady: boolean;
  publishedFlowCount: number;
  aiUsage?: unknown;
  cycleResetAt?: string;
  geminiConfigured: boolean;
  knowledgeSummary?: {
    total?: number;
    ready?: number;
    failed?: number;
    processing?: number;
  };
}

// planAllowed is false when the plan lacks the chatbot builder; the
// backend then rejects every settings PATCH.
export type BotSettingsResponse = ApiResponse<{
  settings: BotSettings;
  planAllowed?: boolean;
}>;
export type BotCanvasResponse = ApiResponse<{
  canvasId?: string;
  canvas?: BotCanvasRecord & {
    draftState?: BotCanvasDraftState;
    publishedState?: BotCanvasDraftState | null;
    [key: string]: unknown;
  };
  draftState?: BotCanvasDraftState;
  publishedState?: BotCanvasDraftState | null;
  draftRevision?: number;
  draftChanges?: BotDraftChanges;
  live?: BotCanvasLiveInfo;
  /** Present on a successful go-live. */
  validation?: BotCanvasValidation;
}>;
export type BotCanvasValidateResponse = ApiResponse<{
  validation: BotCanvasValidation;
}>;
export type BotCanvasesResponse = ApiResponse<{
  canvases: BotCanvasRecord[];
}>;
export type KnowledgeSourcesResponse = ApiResponse<{
  sources: KnowledgeSource[];
}>;
export type KnowledgeSourceResponse = ApiResponse<{
  source: KnowledgeSource;
}>;
export type KnowledgeChunksResponse = ApiResponse<{
  chunks: KnowledgeChunk[];
}>;
export type KnowledgeChunkResponse = ApiResponse<{
  chunk: KnowledgeChunk;
}>;
export type BotStatusResponse = ApiResponse<{
  status: BotStatus;
}>;
export type BotCanvasTriggersResponse = ApiResponse<BotCanvasTriggerSummary>;
