export type TagMode = "manual" | "bot_decides";
export type TagChannelScope = "all" | "whatsapp" | "instagram";
export type TagAutomationTrigger = "keyword" | "ai" | "inactivity";
export type TagStatus = "active" | "archived";
// Exact supported event names for Meta's Conversions API for Business
// Messaging (WhatsApp) -- matches the backend's Tag model enum exactly;
// sending anything outside this list is rejected by Meta.
export type MetaConversionEventName =
  | "Purchase"
  | "LeadSubmitted"
  | "InitiateCheckout"
  | "AddToCart"
  | "ViewContent"
  | "OrderCreated"
  | "OrderShipped"
  | "OrderDelivered"
  | "OrderCanceled"
  | "OrderReturned"
  | "CartAbandoned"
  | "QualifiedLead"
  | "RatingProvided"
  | "ReviewProvided";

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
  // Presence marks this tag as a conversion signal reported to Meta's
  // Conversions API when a subscriber who arrived via a Click-to-WhatsApp
  // ad reaches it. Absent for ordinary tags.
  conversionEventName?: MetaConversionEventName | null;
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
  // The backend's create schema does not accept null here -- omit the
  // field entirely when no conversion event is selected. Only the update
  // schema accepts null, to clear a previously-set value.
  conversionEventName?: MetaConversionEventName;
}

export type UpdateTagPayload = Partial<
  Omit<CreateTagPayload, "name" | "conversionEventName">
> & {
  conversionEventName?: MetaConversionEventName | null;
};
