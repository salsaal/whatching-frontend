import api from "../axiosInstance";
import { BROADCAST_ENDPOINTS } from "../endpoints";
import {
  BroadcastResponse,
  BroadcastsResponse,
  CreateBroadcastPayload,
  StartBroadcastPayload,
  StartBroadcastResponse
} from "../types/broadcasts.type";
import { ApiResponse } from "../types/api";

export const getAllBroadcasts = async (): Promise<BroadcastsResponse> => {
  const res = await api.get<BroadcastsResponse>(BROADCAST_ENDPOINTS.GET_ALL);
  return res.data;
};

export const getBroadcastById = async (
  broadcastId: string
): Promise<BroadcastResponse> => {
  const res = await api.get<BroadcastResponse>(
    BROADCAST_ENDPOINTS.GET_BY_ID(broadcastId)
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
