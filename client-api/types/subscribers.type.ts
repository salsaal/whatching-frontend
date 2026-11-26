export type OffersStoppedReason =
  | "stop_button"
  | "whatsapp_setting"
  | "meta_error"
  | "manual";

export interface Subscriber {
  _id: string;
  orgId: string;
  /** Missing for a WhatsApp customer who only shared a username. */
  phoneNumber?: string;
  /** Set for a customer with a WhatsApp username. */
  whatsappUsername?: string;
  firstName?: string;
  lastName?: string;
  tags: string[];
  broadcastEligibility?: "eligible" | "retained_only";
  broadcastEligibilityReason?: string;
  broadcastEligibilityMode?: "auto" | "excluded";
  isOptedIn: boolean;
  /** Offers (marketing messages) are stopped; order updates still go. */
  offersStopped?: boolean;
  offersStoppedReason?: OffersStoppedReason | null;
  lastInteraction?: string;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  optInSource?: string;
  waId?: string;
  instagramUserId?: string;
  instagramUsername?: string;
  instagramProfilePictureUrl?: string;
  spamMutedUntil?: string;
  spamMutedReason?: string;
  /**
   * Custom fields, e.g. { city: "Pune" }. Saving `metadata` replaces the
   * whole set, so always send every field.
   */
  metadata?: Record<string, unknown>;
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
    summary?: {
      total: number;
      optedIn: number;
      optedOut: number;
      whatsapp: number;
      instagram: number;
      both: number;
    };
  };
}

export interface SubscriberResponse {
  status: string;
  data: {
    subscriber: Subscriber;
    conversation?: ConversationSummary;
  };
}

export interface UpdateSubscriberPayload extends Partial<SubscriberPayload> {
  offersStopped?: boolean;
}

export interface SubscriberPayload {
  phoneNumber: string;
  countryIso?: string;
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

export interface BulkDeleteSubscribersResponse {
  status: string;
  message: string;
  data: {
    deletedCount: number;
  };
}
