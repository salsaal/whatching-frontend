import api from "../axiosInstance";
import { INSTAGRAM_ENDPOINTS } from "../endpoints";
import {
  ConnectInstagramManualPayload,
  InstagramAutomationLogsResponse,
  InstagramCanvasDetailResponse,
  InstagramCanvasPublishResponse,
  InstagramCanvasResponse,
  InstagramCanvasRecord,
  InstagramCanvasState,
  InstagramCanvasValidationResponse,
  InstagramCanvasesResponse,
  InstagramCommentRulePayload,
  InstagramCommentRuleResponse,
  InstagramCommentRulesResponse,
  InstagramConnectResponse,
  InstagramFlowsResponse,
  InstagramMediaResponse,
  InstagramStatusResponse
} from "../types/instagram.type";

const compactParams = (params: object = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => {
      if (value === undefined || value === null || value === "") return false;
      if (value === "all") return false;
      return true;
    })
  );

export const getInstagramStatus =
  async (): Promise<InstagramStatusResponse> => {
    const res = await api.get<InstagramStatusResponse>(
      INSTAGRAM_ENDPOINTS.STATUS
    );
    return res.data;
  };

export const connectInstagramManual = async (
  payload: ConnectInstagramManualPayload
): Promise<InstagramConnectResponse> => {
  const res = await api.patch<InstagramConnectResponse>(
    INSTAGRAM_ENDPOINTS.CONNECT_MANUAL,
    payload
  );
  return res.data;
};

export const syncInstagramStatus =
  async (): Promise<InstagramConnectResponse> => {
    const res = await api.post<InstagramConnectResponse>(
      INSTAGRAM_ENDPOINTS.SYNC
    );
    return res.data;
  };

export const disconnectInstagram =
  async (): Promise<InstagramConnectResponse> => {
    const res = await api.post<InstagramConnectResponse>(
      INSTAGRAM_ENDPOINTS.DISCONNECT
    );
    return res.data;
  };

export const getInstagramMedia = async (
  params: {
    page?: number;
    limit?: number;
    mediaType?: string;
    mediaProductType?: string;
    search?: string;
  } = {}
): Promise<InstagramMediaResponse> => {
  const res = await api.get<InstagramMediaResponse>(INSTAGRAM_ENDPOINTS.MEDIA, {
    params: compactParams(params)
  });
  return res.data;
};

export const syncInstagramMedia = async (
  params: { limit?: number; after?: string } = {}
): Promise<{
  status: string;
  data: { synced: number; paging: Record<string, unknown> | null };
}> => {
  const res = await api.post(INSTAGRAM_ENDPOINTS.MEDIA_SYNC, undefined, {
    params: compactParams(params)
  });
  return res.data;
};

export const getInstagramCanvasDraft =
  async (): Promise<InstagramCanvasResponse> => {
    const res = await api.get<InstagramCanvasResponse>(
      INSTAGRAM_ENDPOINTS.CANVAS_DRAFT
    );
    return res.data;
  };

export const getInstagramCanvasPublished =
  async (): Promise<InstagramCanvasResponse> => {
    const res = await api.get<InstagramCanvasResponse>(
      INSTAGRAM_ENDPOINTS.CANVAS_PUBLISHED
    );
    return res.data;
  };

export const saveInstagramCanvasDraft = async (
  draftState: InstagramCanvasState
): Promise<InstagramCanvasResponse> => {
  const res = await api.patch<InstagramCanvasResponse>(
    INSTAGRAM_ENDPOINTS.CANVAS_DRAFT,
    { draftState }
  );
  return res.data;
};

export const validateInstagramCanvas =
  async (): Promise<InstagramCanvasValidationResponse> => {
    const res = await api.post<InstagramCanvasValidationResponse>(
      INSTAGRAM_ENDPOINTS.CANVAS_VALIDATE
    );
    return res.data;
  };

export const publishInstagramCanvas = async (
  draftState?: InstagramCanvasState
): Promise<InstagramCanvasPublishResponse> => {
  const res = await api.post<InstagramCanvasPublishResponse>(
    INSTAGRAM_ENDPOINTS.CANVAS_PUBLISH,
    draftState ? { draftState } : {}
  );
  return res.data;
};

export const getInstagramCanvases =
  async (): Promise<InstagramCanvasesResponse> => {
    const res = await api.get<InstagramCanvasesResponse>(
      INSTAGRAM_ENDPOINTS.CANVASES
    );
    return res.data;
  };

export const createInstagramCanvas = async (
  payload: { name?: string } = {}
): Promise<{ status: string; data: { canvas: InstagramCanvasRecord } }> => {
  const res = await api.post<{ status: string; data: { canvas: InstagramCanvasRecord } }>(
    INSTAGRAM_ENDPOINTS.CANVASES,
    payload
  );
  return res.data;
};

export const getInstagramCanvas = async (
  canvasId: string
): Promise<InstagramCanvasDetailResponse> => {
  const res = await api.get<InstagramCanvasDetailResponse>(
    INSTAGRAM_ENDPOINTS.CANVAS_BY_ID(canvasId)
  );
  return res.data;
};

export const updateInstagramCanvas = async ({
  canvasId,
  name
}: {
  canvasId: string;
  name: string;
}): Promise<{ status: string; data: { canvas: InstagramCanvasRecord } }> => {
  const res = await api.patch<{ status: string; data: { canvas: InstagramCanvasRecord } }>(
    INSTAGRAM_ENDPOINTS.CANVAS_BY_ID(canvasId),
    { name }
  );
  return res.data;
};

export const saveInstagramCanvasDraftById = async ({
  canvasId,
  draftState
}: {
  canvasId: string;
  draftState: InstagramCanvasState;
}): Promise<InstagramCanvasResponse> => {
  const res = await api.put<InstagramCanvasResponse>(
    INSTAGRAM_ENDPOINTS.CANVAS_DRAFT_BY_ID(canvasId),
    { draftState }
  );
  return res.data;
};

export const validateInstagramCanvasById = async (
  canvasId: string
): Promise<InstagramCanvasValidationResponse> => {
  const res = await api.post<InstagramCanvasValidationResponse>(
    INSTAGRAM_ENDPOINTS.CANVAS_VALIDATE_BY_ID(canvasId)
  );
  return res.data;
};

export const publishInstagramCanvasById = async ({
  canvasId,
  draftState
}: {
  canvasId: string;
  draftState?: InstagramCanvasState;
}): Promise<InstagramCanvasPublishResponse> => {
  const res = await api.post<InstagramCanvasPublishResponse>(
    INSTAGRAM_ENDPOINTS.CANVAS_PUBLISH_BY_ID(canvasId),
    draftState ? { draftState } : {}
  );
  return res.data;
};

export const activateInstagramCanvas = async (
  canvasId: string
): Promise<{ status: string; data: { canvas: InstagramCanvasRecord } }> => {
  const res = await api.post<{ status: string; data: { canvas: InstagramCanvasRecord } }>(
    INSTAGRAM_ENDPOINTS.CANVAS_ACTIVATE_BY_ID(canvasId)
  );
  return res.data;
};

export const deleteInstagramCanvas = async (
  canvasId: string
): Promise<{ status: string; data: { canvas: InstagramCanvasRecord } }> => {
  const res = await api.delete<{ status: string; data: { canvas: InstagramCanvasRecord } }>(
    INSTAGRAM_ENDPOINTS.CANVAS_BY_ID(canvasId)
  );
  return res.data;
};

export const getInstagramFlows = async (
  params: { page?: number; limit?: number; status?: string; triggerType?: string } = {}
): Promise<InstagramFlowsResponse> => {
  const res = await api.get<InstagramFlowsResponse>(
    INSTAGRAM_ENDPOINTS.FLOWS,
    { params: compactParams(params) }
  );
  return res.data;
};

export const getInstagramCommentRules = async (
  params: { page?: number; limit?: number; status?: string } = {}
): Promise<InstagramCommentRulesResponse> => {
  const res = await api.get<InstagramCommentRulesResponse>(
    INSTAGRAM_ENDPOINTS.COMMENT_RULES,
    { params: compactParams(params) }
  );
  return res.data;
};

export const createInstagramCommentRule = async (
  payload: InstagramCommentRulePayload
): Promise<InstagramCommentRuleResponse> => {
  const res = await api.post<InstagramCommentRuleResponse>(
    INSTAGRAM_ENDPOINTS.COMMENT_RULES,
    payload
  );
  return res.data;
};

export const updateInstagramCommentRule = async ({
  ruleId,
  payload
}: {
  ruleId: string;
  payload: Partial<InstagramCommentRulePayload>;
}): Promise<InstagramCommentRuleResponse> => {
  const res = await api.patch<InstagramCommentRuleResponse>(
    INSTAGRAM_ENDPOINTS.COMMENT_RULE_BY_ID(ruleId),
    payload
  );
  return res.data;
};

export const enableInstagramCommentRule = async (
  ruleId: string
): Promise<InstagramCommentRuleResponse> => {
  const res = await api.post<InstagramCommentRuleResponse>(
    INSTAGRAM_ENDPOINTS.COMMENT_RULE_ENABLE(ruleId)
  );
  return res.data;
};

export const disableInstagramCommentRule = async (
  ruleId: string
): Promise<InstagramCommentRuleResponse> => {
  const res = await api.post<InstagramCommentRuleResponse>(
    INSTAGRAM_ENDPOINTS.COMMENT_RULE_DISABLE(ruleId)
  );
  return res.data;
};

export const deleteInstagramCommentRule = async (
  ruleId: string
): Promise<InstagramCommentRuleResponse> => {
  const res = await api.delete<InstagramCommentRuleResponse>(
    INSTAGRAM_ENDPOINTS.COMMENT_RULE_BY_ID(ruleId)
  );
  return res.data;
};

export const getInstagramAutomationLogs = async (
  params: { page?: number; limit?: number; ruleId?: string; status?: string } = {}
): Promise<InstagramAutomationLogsResponse> => {
  const res = await api.get<InstagramAutomationLogsResponse>(
    INSTAGRAM_ENDPOINTS.AUTOMATION_LOGS,
    { params: compactParams(params) }
  );
  return res.data;
};
