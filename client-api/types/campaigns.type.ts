export type CampaignSourceType = "ad" | "post" | "unknown";

export interface CampaignSource {
  _id: string;
  orgId: string;
  sourceId: string;
  label: string;
  sourceType: CampaignSourceType;
  firstSeenAt: string;
  lastTouchAt: string;
  touchCount: number;
  subscriberCount: number;
}

export interface CampaignsResponse {
  status: string;
  data: {
    campaigns: CampaignSource[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

export interface AdReferralTouch {
  _id: string;
  orgId: string;
  subscriberId: string;
  conversationId?: string;
  metaMessageId: string;
  channel: "whatsapp";
  sourceType: CampaignSourceType;
  sourceId: string;
  sourceUrl?: string;
  headline?: string;
  body?: string;
  mediaType?: string;
  imageUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  ctwaClid?: string;
  ref?: string;
  occurredAt: string;
  createdAt: string;
}

export interface SubscriberCampaignSource {
  sourceId: string;
  label: string;
  sourceType: CampaignSourceType;
  firstTouchAt: string;
  lastTouchAt: string;
  touchCount: number;
}

export interface CampaignTouchesResponse {
  status: string;
  data: {
    campaignSources: SubscriberCampaignSource[];
    touches: AdReferralTouch[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}
