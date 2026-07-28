import api from "../axiosInstance";
import { ANALYTICS_ENDPOINTS } from "../endpoints";
import {
  AnalyticsRange,
  DashboardAnalyticsResponse
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
