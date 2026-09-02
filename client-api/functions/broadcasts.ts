import api from "../axiosInstance";
import { BROADCAST_ENDPOINTS } from "../endpoints";
import {
  BroadcastAudience,
  BroadcastResponse,
  BroadcastRetryResponse,
  BroadcastListParams,
  BroadcastsResponse,
  CreateBroadcastPayload,
  StartBroadcastPayload,
  StartBroadcastResponse
} from "../types/broadcasts.type";
import { ApiResponse } from "../types/api";

export const getAllBroadcasts = async (
  params: BroadcastListParams = {}
): Promise<BroadcastsResponse> => {
  const res = await api.get<BroadcastsResponse>(BROADCAST_ENDPOINTS.GET_ALL, {
    params
  });
  return res.data;
};

export const getBroadcastById = async (
  broadcastId: string,
  params: { page?: number; limit?: number; recipientStatus?: string } = {}
): Promise<BroadcastResponse> => {
  const res = await api.get<BroadcastResponse>(
    BROADCAST_ENDPOINTS.GET_BY_ID(broadcastId),
    { params }
  );
  return res.data;
};

export const createBroadcast = async (
  payload: CreateBroadcastPayload
): Promise<BroadcastResponse> => {
  const res = await api.post<BroadcastResponse>(
    BROADCAST_ENDPOINTS.CREATE,
    payload
  );
  return res.data;
};

export const previewBroadcastAudienceCount = async (
  audience: BroadcastAudience
): Promise<ApiResponse<{ count: number }>> => {
  const res = await api.post<ApiResponse<{ count: number }>>(
    BROADCAST_ENDPOINTS.AUDIENCE_COUNT,
    { audience }
  );
  return res.data;
};

export const startBroadcast = async ({
  broadcastId,
  payload
}: {
  broadcastId: string;
  payload?: StartBroadcastPayload;
}): Promise<StartBroadcastResponse> => {
  const res = await api.post<StartBroadcastResponse>(
    BROADCAST_ENDPOINTS.START(broadcastId),
    payload || {}
  );
  return res.data;
};

export const cancelBroadcast = async (
  broadcastId: string
): Promise<ApiResponse> => {
  const res = await api.post<ApiResponse>(
    BROADCAST_ENDPOINTS.CANCEL(broadcastId)
  );
  return res.data;
};

export const consentToBroadcastMessagingLimitRetry = async (
  broadcastId: string
): Promise<BroadcastRetryResponse> => {
  const res = await api.post<BroadcastRetryResponse>(
    BROADCAST_ENDPOINTS.MESSAGING_LIMIT_RETRY(broadcastId),
    { consent: true }
  );
  return res.data;
};
