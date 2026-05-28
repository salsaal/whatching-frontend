export type MediaFileType = "image" | "video" | "document";

export interface MediaAsset {
  _id: string;
  orgId: string;
  name: string;
  fileType: MediaFileType;
  fileSize: number;
  cloudinaryUrl: string;
  metaHandle: string;
  createdAt: string;
  updatedAt: string;
  __v?: number;
}

export interface MediaResponse {
  status: string;
  results?: number;
  data: {
    media: MediaAsset[];
  };
}

export interface SingleMediaResponse {
  status: string;
  data: {
    media: MediaAsset;
  };
}

export interface BulkDeleteMediaResponse {
  status: string;
  message: string;
  data: {
    deletedCount: number;
  };
}
