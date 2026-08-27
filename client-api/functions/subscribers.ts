import api from "../axiosInstance";
import { SUBSCRIBER_ENDPOINTS } from "../endpoints";
import {
  BulkDeleteSubscribersResponse,
  ImportSubscribersPayload,
  ImportSubscribersResponse,
  SubscriberPayload,
  SubscriberResponse,
  SubscribersResponse
} from "../types/subscribers.type";
import {
  CreateTagPayload,
  TagResponse,
  TagsResponse,
  UpdateTagPayload
} from "../types/tags.type";

export const getAllSubscribers = async (
  params: {
    channel?: "all" | "whatsapp" | "instagram";
    page?: number;
    limit?: number;
    q?: string;
    tag?: string;
    broadcastEligibility?: "all" | "eligible" | "retained_only";
  } = {}
): Promise<SubscribersResponse> => {
  const res = await api.get<SubscribersResponse>(SUBSCRIBER_ENDPOINTS.GET_ALL, {
    params: {
      ...(params.channel && params.channel !== "all"
        ? { channel: params.channel }
        : {}),
      ...(params.page ? { page: params.page } : {}),
      ...(params.limit ? { limit: params.limit } : {}),
      ...(params.q?.trim() ? { q: params.q.trim() } : {}),
      ...(params.tag?.trim() ? { tag: params.tag.trim() } : {}),
      ...(params.broadcastEligibility && params.broadcastEligibility !== "all"
        ? { broadcastEligibility: params.broadcastEligibility }
        : {})
    }
  });
  return res.data;
};

export const getSubscriberById = async (
  subscriberId: string
): Promise<SubscriberResponse> => {
  const res = await api.get<SubscriberResponse>(
    SUBSCRIBER_ENDPOINTS.GET_BY_ID(subscriberId)
  );
  return res.data;
};

export const updateSubscriber = async ({
  subscriberId,
  payload
}: {
  subscriberId: string;
  payload: Partial<SubscriberPayload>;
}): Promise<SubscriberResponse> => {
  const res = await api.patch<SubscriberResponse>(
    SUBSCRIBER_ENDPOINTS.UPDATE(subscriberId),
    payload
  );
  return res.data;
};

export const updateSubscriberBroadcastEligibility = async ({
  subscriberId,
  mode
}: {
  subscriberId: string;
  mode: "auto" | "excluded";
}): Promise<SubscriberResponse> => {
  const res = await api.patch<SubscriberResponse>(
    SUBSCRIBER_ENDPOINTS.BROADCAST_ELIGIBILITY(subscriberId),
    { mode }
  );
  return res.data;
};

export const importSubscribers = async (
  payload: ImportSubscribersPayload
): Promise<ImportSubscribersResponse> => {
  const res = await api.post<ImportSubscribersResponse>(
    SUBSCRIBER_ENDPOINTS.IMPORT,
    payload
  );
  return res.data;
};

export const bulkDeleteSubscribers = async (
  subscriberIds: string[]
): Promise<BulkDeleteSubscribersResponse> => {
  const res = await api.post<BulkDeleteSubscribersResponse>(
    SUBSCRIBER_ENDPOINTS.BULK_DELETE,
    { subscriberIds }
  );
  return res.data;
};

export const deleteSubscriber = async (
  subscriberId: string
): Promise<BulkDeleteSubscribersResponse> => {
  const res = await api.post<BulkDeleteSubscribersResponse>(
    SUBSCRIBER_ENDPOINTS.BULK_DELETE,
    { subscriberIds: [subscriberId] }
  );
  return res.data;
};

export const getTags = async (): Promise<TagsResponse> => {
  const res = await api.get<TagsResponse>(SUBSCRIBER_ENDPOINTS.TAGS);
  return res.data;
};

export const createTag = async (
  payload: string | CreateTagPayload
): Promise<TagResponse> => {
  const body = typeof payload === "string" ? { name: payload } : payload;
  const res = await api.post<TagResponse>(SUBSCRIBER_ENDPOINTS.TAGS, body);
  return res.data;
};

export const updateTag = async ({
  tagId,
  payload
}: {
  tagId: string;
  payload: UpdateTagPayload;
}): Promise<TagResponse> => {
  const res = await api.patch<TagResponse>(
    SUBSCRIBER_ENDPOINTS.TAG_BY_ID(tagId),
    payload
  );
  return res.data;
};

export const deleteTag = async (tag: string): Promise<TagResponse> => {
  const res = await api.delete<TagResponse>(
    SUBSCRIBER_ENDPOINTS.TAG_BY_NAME(tag)
  );
  return res.data;
};

export const addSubscriberTags = async ({
  subscriberId,
  tags
}: {
  subscriberId: string;
  tags: string[];
}): Promise<SubscriberResponse> => {
  const res = await api.post<SubscriberResponse>(
    SUBSCRIBER_ENDPOINTS.SUBSCRIBER_TAGS(subscriberId),
    { tags }
  );
  return res.data;
};

export const removeSubscriberTag = async ({
  subscriberId,
  tag
}: {
  subscriberId: string;
  tag: string;
}): Promise<SubscriberResponse> => {
  const res = await api.delete<SubscriberResponse>(
    SUBSCRIBER_ENDPOINTS.SUBSCRIBER_TAG_BY_NAME(subscriberId, tag)
  );
  return res.data;
};
