export type CampaignSourceType = "ad" | "post" | "unknown";
export type CampaignSourceLabelSource =
  | "ref"
  | "headline"
  | "fallback"
  | "manual"
  | "meta_api";

/**
 * What we send to the first message from an ad. "off" is the normal bot
 * reply. On one ad, "default" (or no reply at all) means "same as all ads".
 */
export type AdReplyMode = "off" | "message" | "flow";

export interface AdReplySetting {
  mode: AdReplyMode;
  text?: string;
  triggerKey?: string;
}

export interface AdSourceReplySetting {
  mode: AdReplyMode | "default";
  text?: string;
  triggerKey?: string;
}

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
  /** This ad's own reply. Missing means it follows the all-ads setting. */
  reply?: AdSourceReplySetting | null;
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
  /** e.g. "INR". */
  currency?: string | null;
  impressions: number;
  clicks: number;
  reach: number;
}

export interface CampaignPerformanceResponse {
  status: string;
  data: {
    campaign: CampaignSource;
    /** Spend is per campaign, so the numbers cover every ad in it. */
    scope?: "campaign";
    campaignName?: string | null;
    adsInCampaign?: number;
    spendAvailable: boolean;
    message?: string;
    range: { start: string; end: string };
    spend: CampaignSpend | null;
    lastSyncedAt?: string | null;
    /** People whose message from one of the campaign's ads came in the range. */
    leadsInRange?: number;
    /** subscriberCount is the all-time lead count for this ad. */
    touches: { subscriberCount: number; touchCount: number };
    /** null without spend for the dates, or without leads. */
    costPerConversation?: number | null;
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
