import api from "../axiosInstance";
import { ORGANIZATION_ENDPOINTS } from "../endpoints";
import {
  ConnectMetaPayload,
  DeleteOrganizationResponse,
  EmbeddedSignupConnectPayload,
  IntegrationStatusResponse,
  AddAgentPayload,
  AddAgentResponse,
  BillingHistoryResponse,
  CancelSubscriptionResponse,
  OrganizationResponse,
  OrganizationsResponse,
  SubscribeResponse,
  TeamResponse
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

export const deleteOrganization = async (payload: {
  confirmation: string;
}): Promise<DeleteOrganizationResponse> => {
  const res = await api.delete<DeleteOrganizationResponse>(
    ORGANIZATION_ENDPOINTS.DELETE_ORGANIZATION,
    { data: payload }
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

export const connectMetaEmbeddedSignup = async (
  payload: EmbeddedSignupConnectPayload
): Promise<OrganizationResponse> => {
  const res = await api.post<OrganizationResponse>(
    ORGANIZATION_ENDPOINTS.CONNECT_META_EMBEDDED_SIGNUP,
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

export const getTeam = async (): Promise<TeamResponse> => {
  const res = await api.get<TeamResponse>(ORGANIZATION_ENDPOINTS.TEAM);
  return res.data;
};

export const addAgent = async (
  payload: AddAgentPayload
): Promise<AddAgentResponse> => {
  const res = await api.post<AddAgentResponse>(
    ORGANIZATION_ENDPOINTS.ADD_AGENT,
    payload
  );
  return res.data;
};

export const removeTeamMember = async (membershipId: string): Promise<void> => {
  await api.delete(ORGANIZATION_ENDPOINTS.TEAM_MEMBER(membershipId));
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
