import api from "../axiosInstance";
import { STORE_ENDPOINTS } from "../endpoints";
import {
  ConnectWooCommercePayload,
  CreateCartTemplatePayload,
  CreateCartTemplateResponse,
  ConnectWooCommerceResponse,
  CreateStoreTemplatesPayload,
  CreateStoreTemplatesResponse,
  StoreCartsResponse,
  StoreCheckResponse,
  StoreDisconnectResponse,
  StoreOrdersResponse,
  StorePluginCodeResponse,
  StoreResponse,
  StoreOrdersShow,
  StoreStatusesResponse,
  StoreSummaryResponse,
  UpdateStoreSettingsPayload,
  UpdateStoreSettingsResponse
} from "../types/stores.type";

export const getStore = async (): Promise<StoreResponse> => {
  const res = await api.get<StoreResponse>(STORE_ENDPOINTS.GET);
  return res.data;
};

export const connectWooCommerce = async (
  payload: ConnectWooCommercePayload
): Promise<ConnectWooCommerceResponse> => {
  const res = await api.post<ConnectWooCommerceResponse>(
    STORE_ENDPOINTS.CONNECT_WOOCOMMERCE,
    payload
  );
  return res.data;
};

export const updateStoreSettings = async ({
  connectionId,
  payload
}: {
  connectionId: string;
  payload: UpdateStoreSettingsPayload;
}): Promise<UpdateStoreSettingsResponse> => {
  const res = await api.patch<UpdateStoreSettingsResponse>(
    STORE_ENDPOINTS.SETTINGS(connectionId),
    payload
  );
  return res.data;
};

export const createStoreTemplates = async ({
  connectionId,
  payload
}: {
  connectionId: string;
  payload: CreateStoreTemplatesPayload;
}): Promise<CreateStoreTemplatesResponse> => {
  const res = await api.post<CreateStoreTemplatesResponse>(
    STORE_ENDPOINTS.TEMPLATES(connectionId),
    payload
  );
  return res.data;
};

export const getStoreStatuses = async (
  connectionId: string
): Promise<StoreStatusesResponse> => {
  const res = await api.get<StoreStatusesResponse>(
    STORE_ENDPOINTS.STATUSES(connectionId)
  );
  return res.data;
};

export const getStoreOrders = async ({
  connectionId,
  page = 1,
  limit = 25,
  show
}: {
  connectionId: string;
  page?: number;
  limit?: number;
  /** Only orders with a message not sent, or COD orders awaiting an answer. */
  show?: StoreOrdersShow;
}): Promise<StoreOrdersResponse> => {
  const res = await api.get<StoreOrdersResponse>(
    STORE_ENDPOINTS.ORDERS(connectionId),
    { params: { page, limit, ...(show && show !== "all" ? { show } : {}) } }
  );
  return res.data;
};

/** This calendar month's numbers for the top of the Store page. */
export const getStoreSummary = async (
  connectionId: string
): Promise<StoreSummaryResponse> => {
  const res = await api.get<StoreSummaryResponse>(
    STORE_ENDPOINTS.SUMMARY(connectionId)
  );
  return res.data;
};

export const checkStoreConnection = async (
  connectionId: string
): Promise<StoreCheckResponse> => {
  const res = await api.post<StoreCheckResponse>(
    STORE_ENDPOINTS.CHECK(connectionId)
  );
  return res.data;
};

export const disconnectStore = async (
  connectionId: string
): Promise<StoreDisconnectResponse> => {
  const res = await api.delete<StoreDisconnectResponse>(
    STORE_ENDPOINTS.BY_ID(connectionId)
  );
  return res.data;
};

/** A one-time code for linking the WordPress plugin. */
export const createStorePluginCode = async (
  connectionId: string
): Promise<StorePluginCodeResponse> => {
  const res = await api.post<StorePluginCodeResponse>(
    STORE_ENDPOINTS.PLUGIN_CODE(connectionId)
  );
  return res.data;
};

export const getStoreCarts = async ({
  connectionId,
  page = 1,
  limit = 25
}: {
  connectionId: string;
  page?: number;
  limit?: number;
}): Promise<StoreCartsResponse> => {
  const res = await api.get<StoreCartsResponse>(
    STORE_ENDPOINTS.CARTS(connectionId),
    { params: { page, limit } }
  );
  return res.data;
};

/** The ready-made reminder; the backend also puts it on empty reminders. */
export const createCartTemplate = async ({
  connectionId,
  payload
}: {
  connectionId: string;
  payload: CreateCartTemplatePayload;
}): Promise<CreateCartTemplateResponse> => {
  const res = await api.post<CreateCartTemplateResponse>(
    STORE_ENDPOINTS.CART_TEMPLATE(connectionId),
    payload
  );
  return res.data;
};
