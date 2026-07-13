import { ApiResponse } from "./api";

export type BotBlockType =
  | "text"
  | "buttons"
  | "list"
  | "image"
  | "document"
  | "video"
  | "location"
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
  nodes: BotCanvasNode[];
  edges: BotCanvasEdge[];
  updatedAt?: string;
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

export interface BotSettings {
  isBotEnabled: boolean;
  isAiEnabled: boolean;
  systemPrompt?: string;
  defaultTriggerKey?: string;
  greetingKeywords?: string[];
  optOutKeywords?: string[];
  escalationTriggerIds?: string[];
  autoTimeoutMinutes?: number;
  geminiModel?: string;
}

export type BotSettingsPatch = Partial<
  Pick<
    BotSettings,
    | "isBotEnabled"
    | "isAiEnabled"
    | "greetingKeywords"
    | "optOutKeywords"
    | "escalationTriggerIds"
  >
>;

export interface KnowledgeSource {
  _id: string;
  type: "text" | "faq" | "file";
  status: "pending" | "processing" | "ready" | "failed";
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
  createdAt?: string;
  updatedAt?: string;
}

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

export type BotSettingsResponse = ApiResponse<{ settings: BotSettings }>;
export type BotCanvasResponse = ApiResponse<{
  canvas?: {
    draftState?: BotCanvasDraftState;
    publishedState?: BotCanvasDraftState;
    [key: string]: unknown;
  };
  draftState?: BotCanvasDraftState;
  publishedState?: BotCanvasDraftState;
}>;
export type KnowledgeSourcesResponse = ApiResponse<{
  sources: KnowledgeSource[];
}>;
export type KnowledgeSourceResponse = ApiResponse<{
  source: KnowledgeSource;
}>;
export type BotStatusResponse = ApiResponse<{
  status: BotStatus;
}>;
