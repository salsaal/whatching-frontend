export type CampaignSourceType = "ad" | "post" | "unknown";
export type CampaignSourceLabelSource =
  | "ref"
  | "headline"
  | "fallback"
  | "manual"
  | "meta_api";

export interface CampaignSource {
  _id: string;
  orgId: string;
  sourceId: string;
  label: string;
  // Where `label` came from -- 'meta_api' (the real Ads Manager name) and
  // 'ref' (the advertiser's own ref URL parameter) are trustworthy;
  // 'headline'/'fallback' mean it was guessed and probably needs review.
  labelSource: CampaignSourceLabelSource;
  campaignId?: string;
  campaignName?: string;
  adSetId?: string;
  adSetName?: string;
  adName?: string;
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

export interface UpdateCampaignSourceResponse {
  status: string;
  data: {
    campaign: CampaignSource;
  };
}

export interface CampaignSpend {
  amount: number;
  impressions: number;
  clicks: number;
  reach: number;
}

export interface CampaignConversionRow {
  eventName: string;
  count: number;
  subscriberCount: number;
}

export interface CampaignPerformanceResponse {
  status: string;
  data: {
    campaign: CampaignSource;
    spendAvailable: boolean;
    message?: string;
    range: { start: string; end: string };
    spend: CampaignSpend | null;
    touches: { subscriberCount: number; touchCount: number };
    conversions: CampaignConversionRow[];
    costPerConversation?: number | null;
    costPerConversion?: number | null;
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
