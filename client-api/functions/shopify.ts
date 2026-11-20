import { SHOPIFY_ENDPOINTS } from "../endpoints";
import shopifyApi from "../shopifyInstance";
import type {
  ShopifyLinkPayload,
  ShopifyLinkResponse,
  ShopifySessionResponse,
  ShopifyStoreResponse,
  ShopifyStoreSettingsPayload
} from "../types/shopify.type";
import type {
  CreateStoreTemplatesPayload,
  CreateStoreTemplatesResponse,
  StoreCheckResponse,
  StoreOrdersResponse,
  UpdateStoreSettingsResponse
} from "../types/stores.type";

/** On every app open: it also finishes setting up access after an install. */
export const openShopifySession = async (): Promise<ShopifySessionResponse> => {
  const res = await shopifyApi.post<ShopifySessionResponse>(
    SHOPIFY_ENDPOINTS.SESSION
  );
  return res.data;
};

export const linkShopify = async (
  payload: ShopifyLinkPayload
): Promise<ShopifyLinkResponse> => {
  const res = await shopifyApi.post<ShopifyLinkResponse>(
    SHOPIFY_ENDPOINTS.LINK,
    payload
  );
  return res.data;
};

export const unlinkShopify = async (): Promise<ShopifySessionResponse> => {
  const res = await shopifyApi.post<ShopifySessionResponse>(
    SHOPIFY_ENDPOINTS.UNLINK
  );
  return res.data;
};

export const getShopifyStore = async (): Promise<ShopifyStoreResponse> => {
  const res = await shopifyApi.get<ShopifyStoreResponse>(
    SHOPIFY_ENDPOINTS.STORE
  );
  return res.data;
};

export const updateShopifyStoreSettings = async (
  payload: ShopifyStoreSettingsPayload
): Promise<UpdateStoreSettingsResponse> => {
  const res = await shopifyApi.patch<UpdateStoreSettingsResponse>(
    SHOPIFY_ENDPOINTS.STORE_SETTINGS,
    payload
  );
  return res.data;
};

export const createShopifyStoreTemplates = async (
  payload: CreateStoreTemplatesPayload
): Promise<CreateStoreTemplatesResponse> => {
  const res = await shopifyApi.post<CreateStoreTemplatesResponse>(
    SHOPIFY_ENDPOINTS.STORE_TEMPLATES,
    payload
  );
  return res.data;
};

export const getShopifyStoreOrders = async ({
  page = 1,
  limit = 25
}: {
  page?: number;
  limit?: number;
}): Promise<StoreOrdersResponse> => {
  const res = await shopifyApi.get<StoreOrdersResponse>(
    SHOPIFY_ENDPOINTS.STORE_ORDERS,
    { params: { page, limit } }
  );
  return res.data;
};

export const checkShopifyStore = async (): Promise<StoreCheckResponse> => {
  const res = await shopifyApi.post<StoreCheckResponse>(
    SHOPIFY_ENDPOINTS.STORE_CHECK
  );
  return res.data;
};
