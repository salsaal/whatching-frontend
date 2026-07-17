import api from "../axiosInstance";
import { MEDIA_ENDPOINTS } from "../endpoints";
import {
  BulkDeleteMediaResponse,
  MediaResponse,
  SingleMediaResponse
} from "../types/media.type";

export const getAllMedia = async (): Promise<MediaResponse> => {
  const res = await api.get<MediaResponse>(MEDIA_ENDPOINTS.GET_ALL);
  return res.data;
};

export const uploadMedia = async (files: File[]): Promise<MediaResponse> => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const res = await api.post<MediaResponse>(MEDIA_ENDPOINTS.UPLOAD, formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
  return res.data;
};

export const getMediaById = async (
  mediaId: string
): Promise<SingleMediaResponse> => {
  const res = await api.get<SingleMediaResponse>(
    MEDIA_ENDPOINTS.GET_BY_ID(mediaId)
  );
  return res.data;
};

export const bulkDeleteMedia = async (
  mediaIds: string[]
): Promise<BulkDeleteMediaResponse> => {
  const res = await api.post<BulkDeleteMediaResponse>(
    MEDIA_ENDPOINTS.BULK_DELETE,
    { mediaIds }
  );
  return res.data;
};
