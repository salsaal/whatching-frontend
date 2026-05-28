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
  };
}

export interface IntegrationStatusResponse {
  status: string;
  data: {
    integration: IntegrationStatus;
  };
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
