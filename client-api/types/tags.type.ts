export type TagMode = "manual" | "bot_decides";
export type TagChannelScope = "all" | "whatsapp" | "instagram";
export type TagAutomationTrigger = "keyword" | "ai" | "inactivity";
export type TagStatus = "active" | "archived";

export interface TagAutomation {
  trigger: TagAutomationTrigger;
  addKeywords?: string[];
  removeKeywords?: string[];
  confidenceThreshold?: number;
  inactiveAfterDays?: number;
  reactivateOnReply?: boolean;
}

export interface Tag {
  id: string;
  _id: string;
  orgId: string;
  name: string;
  normalizedName: string;
  description?: string;
  mode: TagMode;
  channelScope: TagChannelScope;
  automation?: TagAutomation;
  cooldownSeconds: number;
  status: TagStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TagsResponse {
  status: string;
  data: {
    tags: Tag[];
  };
}

export interface TagResponse {
  status: string;
  data: {
    tag: Tag;
    tags?: string[];
  };
}

export interface CreateTagPayload {
  name: string;
  description?: string;
  mode?: TagMode;
  channelScope?: TagChannelScope;
  automation?: TagAutomation;
  cooldownSeconds?: number;
}

export type UpdateTagPayload = Partial<
  Omit<CreateTagPayload, "name">
>;
