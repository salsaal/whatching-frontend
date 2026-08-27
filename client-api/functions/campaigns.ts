import api from "../axiosInstance";
import { ANALYTICS_ENDPOINTS, SUBSCRIBER_ENDPOINTS } from "../endpoints";
import {
  CampaignsResponse,
  CampaignTouchesResponse
} from "../types/campaigns.type";

export const listCampaigns = async (
  params: { sort?: "recent" | "leads"; page?: number; limit?: number } = {}
): Promise<CampaignsResponse> => {
  const res = await api.get<CampaignsResponse>(ANALYTICS_ENDPOINTS.CAMPAIGNS, {
    params
  });
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
