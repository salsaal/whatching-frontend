import api from "../axiosInstance";
import { ORGANIZATION_ENDPOINTS } from "../endpoints";
import {
  ConnectMetaPayload,
  IntegrationStatusResponse,
  BillingHistoryResponse,
  CancelSubscriptionResponse,
  OrganizationResponse,
  OrganizationsResponse,
  SubscribeResponse
} from "../types/organizations.type";

export const getMyOrganizations = async (): Promise<OrganizationsResponse> => {
  const res = await api.get<OrganizationsResponse>(
    ORGANIZATION_ENDPOINTS.MY_ORGANIZATIONS
  );
  return res.data;
};

export const getOrganization = async (): Promise<OrganizationResponse> => {
  const res = await api.get<OrganizationResponse>(
    ORGANIZATION_ENDPOINTS.GET_ORGANIZATION
  );
  return res.data;
};

export const setupOrganization = async (payload: {
  name: string;
}): Promise<OrganizationResponse> => {
  const res = await api.post<OrganizationResponse>(
    ORGANIZATION_ENDPOINTS.SETUP,
    payload
  );
  return res.data;
};

export const getIntegrationStatus =
  async (): Promise<IntegrationStatusResponse> => {
    const res = await api.get<IntegrationStatusResponse>(
      ORGANIZATION_ENDPOINTS.INTEGRATION_STATUS
    );
    return res.data;
  };

export const connectMeta = async (
  payload: ConnectMetaPayload
): Promise<OrganizationResponse> => {
  const res = await api.patch<OrganizationResponse>(
    ORGANIZATION_ENDPOINTS.CONNECT_META,
    payload
  );
  return res.data;
};

export const syncMetaIntegration =
  async (): Promise<IntegrationStatusResponse> => {
    const res = await api.post<IntegrationStatusResponse>(
      ORGANIZATION_ENDPOINTS.SYNC_INTEGRATION
    );
    return res.data;
  };

export const purchaseSubscription = async (payload: {
  tier: "basic" | "pro" | "enterprise" | string;
}): Promise<SubscribeResponse> => {
  const res = await api.post<SubscribeResponse>(
    ORGANIZATION_ENDPOINTS.BILLING_SUBSCRIBE,
    payload
  );
  return res.data;
};

export const getBillingHistory = async (): Promise<BillingHistoryResponse> => {
  const res = await api.get<BillingHistoryResponse>(
    ORGANIZATION_ENDPOINTS.BILLING_HISTORY
  );
  return res.data;
};

export const cancelSubscription =
  async (): Promise<CancelSubscriptionResponse> => {
    const res = await api.post<CancelSubscriptionResponse>(
      ORGANIZATION_ENDPOINTS.BILLING_CANCEL
    );
    return res.data;
  };
