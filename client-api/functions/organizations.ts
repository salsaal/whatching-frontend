import api from "../axiosInstance";
import { ORGANIZATION_ENDPOINTS } from "../endpoints";
import {
  ConnectMetaPayload,
  CoexistenceContactSyncResponse,
  DeleteOrganizationResponse,
  EmbeddedSignupConnectPayload,
  IntegrationStatusResponse,
  AddAgentPayload,
  AddAgentResponse,
  BillingHistoryResponse,
  CancelSubscriptionResponse,
  ChangePlanResponse,
  OrganizationResponse,
  OrganizationsResponse,
  RequestCoexistenceContactSyncPayload,
  CreateSupportRequestPayload,
  StartTrialResponse,
  SupportRequestResponse,
  SupportRequestsResponse,
  SubscribeResponse,
  TeamResponse,
  WhatsAppPhoneNumberResponse,
  WhatsAppPhoneNumbersResponse
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

export const requestCoexistenceContactSync = async (
  payload: RequestCoexistenceContactSyncPayload = {}
): Promise<CoexistenceContactSyncResponse> => {
  const res = await api.post<CoexistenceContactSyncResponse>(
    ORGANIZATION_ENDPOINTS.COEXISTENCE_CONTACT_SYNC,
    payload
  );
  return res.data;
};

export const getWhatsAppPhoneNumbers =
  async (): Promise<WhatsAppPhoneNumbersResponse> => {
    const res = await api.get<WhatsAppPhoneNumbersResponse>(
      ORGANIZATION_ENDPOINTS.WHATSAPP_PHONE_NUMBERS
    );
    return res.data;
  };

export const syncWhatsAppPhoneNumbers =
  async (): Promise<WhatsAppPhoneNumbersResponse> => {
    const res = await api.post<WhatsAppPhoneNumbersResponse>(
      ORGANIZATION_ENDPOINTS.WHATSAPP_PHONE_NUMBERS_SYNC
    );
    return res.data;
  };

export const updateWhatsAppPhoneNumber = async ({
  phoneNumberRecordId,
  activeCanvasId,
  metadata
}: {
  phoneNumberRecordId: string;
  activeCanvasId?: string;
  metadata?: Record<string, unknown>;
}): Promise<WhatsAppPhoneNumberResponse> => {
  const res = await api.patch<WhatsAppPhoneNumberResponse>(
    ORGANIZATION_ENDPOINTS.WHATSAPP_PHONE_NUMBER(phoneNumberRecordId),
    {
      ...(activeCanvasId !== undefined ? { activeCanvasId } : {}),
      ...(metadata ? { metadata } : {})
    }
  );
  return res.data;
};

export const setDefaultWhatsAppPhoneNumber = async (
  phoneNumberRecordId: string
): Promise<WhatsAppPhoneNumberResponse> => {
  const res = await api.post<WhatsAppPhoneNumberResponse>(
    ORGANIZATION_ENDPOINTS.WHATSAPP_PHONE_NUMBER_SET_DEFAULT(
      phoneNumberRecordId
    )
  );
  return res.data;
};

export const activateWhatsAppPhoneNumber = async (
  phoneNumberRecordId: string
): Promise<WhatsAppPhoneNumberResponse> => {
  const res = await api.post<WhatsAppPhoneNumberResponse>(
    ORGANIZATION_ENDPOINTS.WHATSAPP_PHONE_NUMBER_ACTIVATE(phoneNumberRecordId)
  );
  return res.data;
};

export const deactivateWhatsAppPhoneNumber = async (
  phoneNumberRecordId: string
): Promise<WhatsAppPhoneNumberResponse> => {
  const res = await api.post<WhatsAppPhoneNumberResponse>(
    ORGANIZATION_ENDPOINTS.WHATSAPP_PHONE_NUMBER_DEACTIVATE(phoneNumberRecordId)
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

export const startFreeTrial = async (payload: {
  tier: "basic" | "pro";
}): Promise<StartTrialResponse> => {
  const res = await api.post<StartTrialResponse>(
    ORGANIZATION_ENDPOINTS.BILLING_START_TRIAL,
    payload
  );
  return res.data;
};

export const changeSubscriptionPlan = async (payload: {
  tier: "basic" | "pro" | "enterprise" | string;
}): Promise<ChangePlanResponse> => {
  const res = await api.post<ChangePlanResponse>(
    ORGANIZATION_ENDPOINTS.BILLING_CHANGE_PLAN,
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

export const getSupportRequests = async (
  params: { page?: number; limit?: number; status?: string } = {}
): Promise<SupportRequestsResponse> => {
  const res = await api.get<SupportRequestsResponse>(
    ORGANIZATION_ENDPOINTS.SUPPORT_REQUESTS,
    { params }
  );
  return res.data;
};

export const createSupportRequest = async (
  payload: CreateSupportRequestPayload
): Promise<SupportRequestResponse> => {
  const res = await api.post<SupportRequestResponse>(
    ORGANIZATION_ENDPOINTS.SUPPORT_REQUESTS,
    payload
  );
  return res.data;
};
