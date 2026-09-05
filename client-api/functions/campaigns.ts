import api from "../axiosInstance";
import { ANALYTICS_ENDPOINTS, SUBSCRIBER_ENDPOINTS } from "../endpoints";
import {
  CampaignPerformanceResponse,
  CampaignsResponse,
  CampaignTouchesResponse,
  UpdateCampaignSourceResponse
} from "../types/campaigns.type";

export const listCampaigns = async (
  params: {
    sort?: "recent" | "leads";
    page?: number;
    limit?: number;
    needsReview?: boolean;
  } = {}
): Promise<CampaignsResponse> => {
  const res = await api.get<CampaignsResponse>(ANALYTICS_ENDPOINTS.CAMPAIGNS, {
    params
  });
  return res.data;
};

export const updateCampaignSource = async ({
  campaignSourceId,
  label
}: {
  campaignSourceId: string;
  label: string;
}): Promise<UpdateCampaignSourceResponse> => {
  const res = await api.patch<UpdateCampaignSourceResponse>(
    ANALYTICS_ENDPOINTS.CAMPAIGN_BY_ID(campaignSourceId),
    { label }
  );
  return res.data;
};

export const getCampaignPerformance = async (
  campaignSourceId: string,
  params: { start?: string; end?: string; range?: "7d" | "30d" | "90d" } = {}
): Promise<CampaignPerformanceResponse> => {
  const res = await api.get<CampaignPerformanceResponse>(
    ANALYTICS_ENDPOINTS.CAMPAIGN_PERFORMANCE(campaignSourceId),
    { params }
  );
  return res.data;
};

export const getSubscriberCampaignTouches = async (
  subscriberId: string,
  params: { page?: number; limit?: number } = {}
): Promise<CampaignTouchesResponse> => {
  const res = await api.get<CampaignTouchesResponse>(
    SUBSCRIBER_ENDPOINTS.CAMPAIGN_TOUCHES(subscriberId),
    { params }
  );
  return res.data;
};
