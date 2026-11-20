import api from "../axiosInstance";
import { QUICK_REPLY_ENDPOINTS } from "../endpoints";
import {
  QuickRepliesResponse,
  QuickReplyPayload,
  QuickReplyResponse
} from "../types/quickReplies.type";

export const listQuickReplies = async (
  search?: string
): Promise<QuickRepliesResponse> => {
  const res = await api.get<QuickRepliesResponse>(QUICK_REPLY_ENDPOINTS.LIST, {
    params: search ? { search } : undefined
  });
  return res.data;
};

export const createQuickReply = async (
  payload: QuickReplyPayload
): Promise<QuickReplyResponse> => {
  const res = await api.post<QuickReplyResponse>(
    QUICK_REPLY_ENDPOINTS.CREATE,
    payload
  );
  return res.data;
};

export const updateQuickReply = async ({
  id,
  ...payload
}: Partial<QuickReplyPayload> & {
  id: string;
}): Promise<QuickReplyResponse> => {
  const res = await api.patch<QuickReplyResponse>(
    QUICK_REPLY_ENDPOINTS.BY_ID(id),
    payload
  );
  return res.data;
};

export const deleteQuickReply = async (
  id: string
): Promise<QuickReplyResponse> => {
  const res = await api.delete<QuickReplyResponse>(
    QUICK_REPLY_ENDPOINTS.BY_ID(id)
  );
  return res.data;
};
