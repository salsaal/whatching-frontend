import api from "../axiosInstance";
import {
  CHAT_ENDPOINTS,
  CONVERSATION_ENDPOINTS,
  MESSAGE_ENDPOINTS
} from "../endpoints";
import {
  ChatBootstrapResponse,
  ConversationContextResponse,
  ConversationListParams,
  ConversationListResponse,
  ConversationMessagesResponse,
  ConversationResponse,
  ConversationStatus,
  SendConversationReplyPayload,
  SendConversationReplyResponse,
  SendTemplateMessagePayload,
  SendTemplateMessageResponse
} from "../types/chat.type";

const compactParams = (params: object) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => {
      if (value === undefined || value === null || value === "") return false;
      if (value === "all") return false;
      if (value === false) return false;
      return true;
    })
  );

export const getChatBootstrap = async (): Promise<ChatBootstrapResponse> => {
  const res = await api.get<ChatBootstrapResponse>(CHAT_ENDPOINTS.BOOTSTRAP);
  return res.data;
};

export const getConversations = async (
  params: ConversationListParams = {}
): Promise<ConversationListResponse> => {
  const res = await api.get<ConversationListResponse>(
    CONVERSATION_ENDPOINTS.GET_ALL,
    {
      params: compactParams(params)
    }
  );
  return res.data;
};

export const getConversation = async (
  conversationId: string
): Promise<ConversationResponse> => {
  const res = await api.get<ConversationResponse>(
    CONVERSATION_ENDPOINTS.GET_BY_ID(conversationId)
  );
  return res.data;
};

export const getConversationContext = async (
  conversationId: string
): Promise<ConversationContextResponse> => {
  const res = await api.get<ConversationContextResponse>(
    CONVERSATION_ENDPOINTS.CONTEXT(conversationId)
  );
  return res.data;
};

export const getConversationMessages = async ({
  conversationId,
  before,
  limit = 50
}: {
  conversationId: string;
  before?: string | null;
  limit?: number;
}): Promise<ConversationMessagesResponse> => {
  const res = await api.get<ConversationMessagesResponse>(
    CONVERSATION_ENDPOINTS.MESSAGES(conversationId),
    {
      params: compactParams({ before, limit })
    }
  );
  return res.data;
};

export const assignConversation = async ({
  conversationId,
  assignedToUserId
}: {
  conversationId: string;
  assignedToUserId: string | null;
}): Promise<ConversationResponse> => {
  const res = await api.patch<ConversationResponse>(
    CONVERSATION_ENDPOINTS.ASSIGN(conversationId),
    { assignedToUserId }
  );
  return res.data;
};

export const updateConversationStatus = async ({
  conversationId,
  status
}: {
  conversationId: string;
  status: ConversationStatus;
}): Promise<ConversationResponse> => {
  const res = await api.patch<ConversationResponse>(
    CONVERSATION_ENDPOINTS.STATUS(conversationId),
    { status }
  );
  return res.data;
};

export const markConversationRead = async (
  conversationId: string
): Promise<ConversationResponse> => {
  const res = await api.patch<ConversationResponse>(
    CONVERSATION_ENDPOINTS.READ(conversationId),
    {}
  );
  return res.data;
};

export const sendConversationReply = async ({
  conversationId,
  payload
}: {
  conversationId: string;
  payload: SendConversationReplyPayload;
}): Promise<SendConversationReplyResponse> => {
  const formData = new FormData();

  if (payload.text) formData.append("text", payload.text);
  if (payload.caption) formData.append("caption", payload.caption);
  if (payload.messageType) formData.append("messageType", payload.messageType);
  if (payload.mediaId) formData.append("mediaId", payload.mediaId);
  if (payload.attachment) formData.append("attachment", payload.attachment);
  if (payload.replyToMessageId) {
    formData.append("replyToMessageId", payload.replyToMessageId);
  }

  const res = await api.post<SendConversationReplyResponse>(
    CONVERSATION_ENDPOINTS.REPLY(conversationId),
    formData
  );
  return res.data;
};

export const sendTemplateMessage = async (
  payload: SendTemplateMessagePayload
): Promise<SendTemplateMessageResponse> => {
  const res = await api.post<SendTemplateMessageResponse>(
    MESSAGE_ENDPOINTS.TEMPLATE_SEND,
    payload
  );
  return res.data;
};
