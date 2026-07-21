import api from "../axiosInstance";
import { BOT_ENDPOINTS } from "../endpoints";
import {
  BotCanvasDraftState,
  BotCanvasResponse,
  BotCanvasesResponse,
  BotSettingsPatch,
  BotSettingsResponse,
  BotStatusResponse,
  KnowledgeSourceResponse,
  KnowledgeSourcesResponse
} from "../types/bot.type";
import { ApiResponse } from "../types/api";

export const getBotSettings = async (): Promise<BotSettingsResponse> => {
  const res = await api.get<BotSettingsResponse>(BOT_ENDPOINTS.SETTINGS);
  return res.data;
};

export const updateBotSettings = async (
  payload: BotSettingsPatch
): Promise<BotSettingsResponse> => {
  const res = await api.patch<BotSettingsResponse>(
    BOT_ENDPOINTS.SETTINGS,
    payload
  );
  return res.data;
};

export const getBotCanvasDraft = async (): Promise<BotCanvasResponse> => {
  const res = await api.get<BotCanvasResponse>(BOT_ENDPOINTS.CANVAS_DRAFT);
  return res.data;
};

export const saveBotCanvasDraft = async (
  draftState: BotCanvasDraftState
): Promise<BotCanvasResponse> => {
  const res = await api.put<BotCanvasResponse>(BOT_ENDPOINTS.CANVAS_DRAFT, {
    draftState
  });
  return res.data;
};

export const validateBotCanvas = async (
  draftState?: BotCanvasDraftState
): Promise<ApiResponse> => {
  const res = await api.post<ApiResponse>(
    BOT_ENDPOINTS.CANVAS_VALIDATE,
    draftState ? { draftState } : undefined
  );
  return res.data;
};

export const publishBotCanvasDraft = async (
  draftState?: BotCanvasDraftState
): Promise<BotCanvasResponse> => {
  const res = await api.post<BotCanvasResponse>(
    BOT_ENDPOINTS.CANVAS_PUBLISH,
    draftState ? { draftState } : undefined
  );
  return res.data;
};

export const getBotCanvasPublished = async (): Promise<BotCanvasResponse> => {
  const res = await api.get<BotCanvasResponse>(BOT_ENDPOINTS.CANVAS_PUBLISHED);
  return res.data;
};

export const listBotCanvases = async (): Promise<BotCanvasesResponse> => {
  const res = await api.get<BotCanvasesResponse>(BOT_ENDPOINTS.CANVASES);
  return res.data;
};

export const createBotCanvas = async (
  payload: { name?: string } = {}
): Promise<BotCanvasResponse> => {
  const res = await api.post<BotCanvasResponse>(
    BOT_ENDPOINTS.CANVASES,
    payload
  );
  return res.data;
};

export const getBotCanvas = async (
  canvasId: string
): Promise<BotCanvasResponse> => {
  const res = await api.get<BotCanvasResponse>(
    BOT_ENDPOINTS.CANVAS_BY_ID(canvasId)
  );
  return res.data;
};

export const updateBotCanvas = async ({
  canvasId,
  name
}: {
  canvasId: string;
  name: string;
}): Promise<BotCanvasResponse> => {
  const res = await api.patch<BotCanvasResponse>(
    BOT_ENDPOINTS.CANVAS_BY_ID(canvasId),
    { name }
  );
  return res.data;
};

export const saveBotCanvasDraftById = async ({
  canvasId,
  draftState
}: {
  canvasId: string;
  draftState: BotCanvasDraftState;
}): Promise<BotCanvasResponse> => {
  const res = await api.put<BotCanvasResponse>(
    BOT_ENDPOINTS.CANVAS_DRAFT_BY_ID(canvasId),
    { draftState }
  );
  return res.data;
};

export const validateBotCanvasById = async (
  canvasId: string
): Promise<ApiResponse> => {
  const res = await api.post<ApiResponse>(
    BOT_ENDPOINTS.CANVAS_VALIDATE_BY_ID(canvasId)
  );
  return res.data;
};

export const publishBotCanvasDraftById = async ({
  canvasId,
  draftState
}: {
  canvasId: string;
  draftState?: BotCanvasDraftState;
}): Promise<BotCanvasResponse> => {
  const res = await api.post<BotCanvasResponse>(
    BOT_ENDPOINTS.CANVAS_PUBLISH_BY_ID(canvasId),
    draftState ? { draftState } : undefined
  );
  return res.data;
};

export const activateBotCanvas = async (
  canvasId: string
): Promise<BotCanvasResponse> => {
  const res = await api.post<BotCanvasResponse>(
    BOT_ENDPOINTS.CANVAS_ACTIVATE_BY_ID(canvasId)
  );
  return res.data;
};

export const archiveBotCanvas = async (
  canvasId: string
): Promise<BotCanvasResponse> => {
  const res = await api.delete<BotCanvasResponse>(
    BOT_ENDPOINTS.CANVAS_BY_ID(canvasId)
  );
  return res.data;
};

export const listKnowledgeSources =
  async (): Promise<KnowledgeSourcesResponse> => {
    const res = await api.get<KnowledgeSourcesResponse>(
      BOT_ENDPOINTS.KNOWLEDGE_SOURCES
    );
    return res.data;
  };

export const createKnowledgeTextSource = async (payload: {
  type: "text" | "faq";
  title: string;
  content?: string;
  faqEntries?: Array<{ question: string; answer: string }>;
}): Promise<KnowledgeSourceResponse> => {
  const res = await api.post<KnowledgeSourceResponse>(
    BOT_ENDPOINTS.KNOWLEDGE_TEXT,
    payload
  );
  return res.data;
};

export const uploadKnowledgeSource = async (
  payload: FormData
): Promise<KnowledgeSourceResponse> => {
  const res = await api.post<KnowledgeSourceResponse>(
    BOT_ENDPOINTS.KNOWLEDGE_UPLOAD,
    payload,
    {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    }
  );
  return res.data;
};

export const deleteKnowledgeSource = async (
  sourceId: string
): Promise<ApiResponse> => {
  const res = await api.delete<ApiResponse>(
    BOT_ENDPOINTS.KNOWLEDGE_SOURCE_BY_ID(sourceId)
  );
  return res.data;
};

export const reingestKnowledgeSource = async (
  sourceId: string
): Promise<KnowledgeSourceResponse> => {
  const res = await api.post<KnowledgeSourceResponse>(
    BOT_ENDPOINTS.KNOWLEDGE_REINGEST(sourceId)
  );
  return res.data;
};

export const getBotStatus = async (): Promise<BotStatusResponse> => {
  const res = await api.get<BotStatusResponse>(BOT_ENDPOINTS.STATUS);
  return res.data;
};
