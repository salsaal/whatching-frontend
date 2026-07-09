import api from "../axiosInstance";
import { TEMPLATE_ENDPOINTS } from "../endpoints";
import {
  CreateDraftPayload,
  CreateTemplatePayload,
  DraftResponse,
  DraftsResponse,
  SubmitDraftResponse,
  SyncTemplatesResponse,
  TemplateResponse,
  TemplatesResponse,
  UpdateApprovedTemplatePayload,
  UpdateDraftPayload
} from "../types/templates.type";
import { ApiResponse } from "../types/api";

export const getAllTemplates = async (): Promise<TemplatesResponse> => {
  const res = await api.get<TemplatesResponse>(TEMPLATE_ENDPOINTS.GET_ALL);
  return res.data;
};

export const syncTemplates = async (): Promise<SyncTemplatesResponse> => {
  const res = await api.post<SyncTemplatesResponse>(TEMPLATE_ENDPOINTS.SYNC);
  return res.data;
};

export const getAllDraftTemplates = async (): Promise<DraftsResponse> => {
  const res = await api.get<DraftsResponse>(TEMPLATE_ENDPOINTS.DRAFTS);
  return res.data;
};

export const getTemplateById = async (
  templateId: string
): Promise<TemplateResponse> => {
  const res = await api.get<TemplateResponse>(
    TEMPLATE_ENDPOINTS.GET_BY_ID(templateId)
  );
  return res.data;
};

export const createTemplate = async (
  payload: CreateTemplatePayload
): Promise<TemplateResponse> => {
  const res = await api.post<TemplateResponse>(
    TEMPLATE_ENDPOINTS.CREATE,
    payload
  );
  return res.data;
};

export const createDraftTemplate = async (
  payload: CreateDraftPayload
): Promise<DraftResponse> => {
  const res = await api.post<DraftResponse>(TEMPLATE_ENDPOINTS.DRAFTS, payload);
  return res.data;
};

export const getDraftTemplateById = async (
  draftId: string
): Promise<DraftResponse> => {
  const res = await api.get<DraftResponse>(
    TEMPLATE_ENDPOINTS.DRAFT_BY_ID(draftId)
  );
  return res.data;
};

export const updateDraftTemplate = async ({
  draftId,
  payload
}: {
  draftId: string;
  payload: UpdateDraftPayload;
}): Promise<DraftResponse> => {
  const res = await api.patch<DraftResponse>(
    TEMPLATE_ENDPOINTS.DRAFT_BY_ID(draftId),
    payload
  );
  return res.data;
};

export const submitDraftTemplate = async (
  draftId: string
): Promise<SubmitDraftResponse> => {
  const res = await api.post<SubmitDraftResponse>(
    TEMPLATE_ENDPOINTS.SUBMIT_DRAFT(draftId)
  );
  return res.data;
};

export const updateApprovedTemplate = async ({
  templateId,
  payload
}: {
  templateId: string;
  payload: UpdateApprovedTemplatePayload;
}): Promise<TemplateResponse> => {
  const res = await api.patch<TemplateResponse>(
    TEMPLATE_ENDPOINTS.UPDATE_APPROVED(templateId),
    payload
  );
  return res.data;
};

export const deleteTemplate = async (
  templateId: string
): Promise<ApiResponse> => {
  const res = await api.delete<ApiResponse>(
    TEMPLATE_ENDPOINTS.DELETE(templateId)
  );
  return res.data;
};

export const deleteDraftTemplate = async (
  draftId: string
): Promise<ApiResponse> => {
  const res = await api.delete<ApiResponse>(
    TEMPLATE_ENDPOINTS.DRAFT_BY_ID(draftId)
  );
  return res.data;
};

export const linkTemplateMedia = async ({
  templateId,
  mediaId
}: {
  templateId: string;
  mediaId: string;
}): Promise<TemplateResponse> => {
  const res = await api.patch<TemplateResponse>(
    TEMPLATE_ENDPOINTS.LINK_MEDIA(templateId),
    { mediaId }
  );
  return res.data;
};
