import { IntegrationStatus, Organization } from "@/stores/organizationStore";

export interface OrganizationsResponse {
  status: string;
  results: number;
  data: {
    organizations: Organization[];
  };
}

export interface OrganizationResponse {
  status: string;
  data: {
    organization: Organization;
    subscribedAppsWarning?: string | null;
  };
}

export interface IntegrationStatusResponse {
  status: string;
  data: {
    integration: IntegrationStatus;
  };
}

export interface ConnectMetaPayload {
  wabaId: string;
  phoneNumberId: string;
  accessToken?: string;
  code?: string;
  coexistenceEnabled?: boolean;
}

export interface EmbeddedSignupConnectPayload {
  code: string;
  wabaId: string;
  phoneNumberId: string;
  waba_id?: string;
  phone_number_id?: string;
  whatsappBusinessAccountId?: string;
  businessPhoneNumberId?: string;
  businessId?: string;
  business_id?: string;
  event?: string;
  sessionEvent?: string;
  signupEvent?: string;
  authResponse?: {
    code?: string;
    [key: string]: unknown;
  };
  data?: {
    waba_id?: string;
    wabaId?: string;
    phone_number_id?: string;
    phoneNumberId?: string;
    business_id?: string;
    event?: string;
    [key: string]: unknown;
  };
  coexistenceEnabled?: boolean;
}

export interface SubscribeResponse {
  status: string;
  data: {
    subscriptionId: string;
    paymentUrl: string;
    key: string;
  };
}

export interface BillingTransaction {
  _id: string;
  orgId: string;
  amount: number;
  type: string;
  status: string;
  description: string;
  referenceId?: string;
  createdAt: string;
  updatedAt: string;
  __v?: number;
}

export interface BillingHistoryResponse {
  status: string;
  data: {
    transactions: BillingTransaction[];
  };
}

export interface CancelSubscriptionResponse {
  status: string;
  message: string;
}

export interface TeamMember {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    phoneNumber?: string;
  };
  orgId: string;
  role: "owner" | "admin" | "agent" | string;
  status: "active" | "invited" | "disabled" | string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamResponse {
  status: string;
  results: number;
  data: {
    team: TeamMember[];
  };
}

export interface AddAgentPayload {
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
  countryIso?: string;
}

export interface AddAgentResponse {
  status: string;
  message?: string;
  data?: {
    agent?: {
      id: string;
      name: string;
      email: string;
      phoneNumber: string;
    };
  };
}
