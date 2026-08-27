import api from "../axiosInstance";
import { ANALYTICS_ENDPOINTS, ORGANIZATION_ENDPOINTS } from "../endpoints";
import {
  AnalyticsRange,
  ConversationCostGroupBy,
  ConversationCostResponse,
  DashboardAnalyticsResponse,
  TemplateAnalyticsResponse,
  TemplateInsightsEnableResponse,
  TemplateInsightsStatusResponse
} from "../types/analytics.type";

export const getDashboardAnalytics = async ({
  range = "30d",
  timezone
}: {
  range?: AnalyticsRange;
  timezone?: string;
} = {}): Promise<DashboardAnalyticsResponse> => {
  const res = await api.get<DashboardAnalyticsResponse>(
    ANALYTICS_ENDPOINTS.DASHBOARD,
    {
      params: {
        range,
        ...(timezone ? { timezone } : {})
      }
    }
  );
  return res.data;
};

export const getConversationCostAnalytics = async ({
  range = "30d",
  groupBy = "category"
}: {
  range?: AnalyticsRange;
  groupBy?: ConversationCostGroupBy;
} = {}): Promise<ConversationCostResponse> => {
  const res = await api.get<ConversationCostResponse>(
    ANALYTICS_ENDPOINTS.CONVERSATION_COSTS,
    { params: { range, groupBy } }
  );
  return res.data;
};

export const getTemplateAnalytics = async ({
  range = "30d"
}: {
  range?: AnalyticsRange;
} = {}): Promise<TemplateAnalyticsResponse> => {
  const res = await api.get<TemplateAnalyticsResponse>(
    ANALYTICS_ENDPOINTS.TEMPLATE_ANALYTICS,
    { params: { range } }
  );
  return res.data;
};

export const getTemplateInsightsStatus = async (
  phoneNumberId?: string
): Promise<TemplateInsightsStatusResponse> => {
  const res = await api.get<TemplateInsightsStatusResponse>(
    ORGANIZATION_ENDPOINTS.TEMPLATE_INSIGHTS_STATUS,
    { params: phoneNumberId ? { phoneNumberId } : {} }
  );
  return res.data;
};

export const enableTemplateInsights = async (
  phoneNumberId?: string
): Promise<TemplateInsightsEnableResponse> => {
  const res = await api.post<TemplateInsightsEnableResponse>(
    ORGANIZATION_ENDPOINTS.TEMPLATE_INSIGHTS_ENABLE,
    { phoneNumberId, acknowledgePermanent: true }
  );
  return res.data;
};
