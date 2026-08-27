import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface OrganizationMetaConfig {
  status?: "pending" | "ready" | "failed" | string;
  businessAccountName?: string;
  clientBusinessId?: string;
  connectedAt?: string;
  displayPhoneNumber?: string;
  lastHealthCheckAt?: string;
  phoneNumberId?: string;
  wabaId?: string;
  messagingLimitTier?: string;
  messagingLimitCount?: number;
  messagingLimitScope?: "business_portfolio";
}

export interface OrganizationUsage {
  aiTokensUsed: number;
  subscribersCount: number;
}

export interface OrganizationBillingProfile {
  country?: "IN";
  legalName: string;
  billingEmail: string;
  address: string;
  state: string;
  pinCode: string;
  gstin?: string;
}

export interface Organization {
  _id: string;
  name: string;
  slug: string;
  timezone?: string;
  planTier: string;
  subscriptionStatus: string;
  subscriptionCancelAtPeriodEnd?: boolean;
  subscriptionCurrentPeriodStart?: string;
  subscriptionCurrentPeriodEnd?: string;
  subscriptionCanceledAt?: string;
  razorpaySubscriptionId?: string;
  scheduledPlanTier?: "basic" | "pro" | null;
  scheduledPlanChangeAt?: string | null;
  pendingRazorpaySubscriptionTier?: "basic" | "pro" | null;
  pendingRazorpaySubscriptionStatus?: string | null;
  pendingRazorpaySubscriptionStartsAt?: string | null;
  pendingRazorpaySubscriptionCheckoutUrl?: string | null;
  trialPlanTier?: "basic" | "pro" | null;
  trialStartedAt?: string;
  trialEndsAt?: string;
  trialConsumedAt?: string;
  billingProfile?: OrganizationBillingProfile | null;
  metaConfig: OrganizationMetaConfig;
  usage: OrganizationUsage;
  createdAt: string;
  updatedAt: string;
  __v?: number;
}

export interface IntegrationStatus {
  state: string;
  wabaId?: string;
  phoneNumberId?: string;
  businessAccountName?: string;
  displayPhoneNumber?: string;
  connectedAt?: string;
  webhookVerified?: boolean;
  webhookVerifiedAt?: string | null;
  lastHealthCheckAt?: string;
  lastTemplateSyncAt?: string | null;
}

interface OrganizationState {
  organizations: Organization[];
  activeOrganization: Organization | null;
  integration: IntegrationStatus | null;
  ownerUserId: string | null;
  hasHydrated: boolean;
  selectedWhatsAppPhoneNumberByOrg: Record<string, string>;
  setOrganizationOwner: (userId: string | null) => void;
  setOrganizations: (organizations: Organization[]) => void;
  addOrganization: (organization: Organization) => void;
  upsertOrganization: (organization: Organization) => void;
  setActiveOrganization: (organization: Organization | null) => void;
  setIntegration: (integration: IntegrationStatus | null) => void;
  setSelectedWhatsAppPhoneNumber: (
    organizationId: string,
    phoneNumberId: string
  ) => void;
  clearOrganizations: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useOrganizationStore = create<OrganizationState>()(
  persist(
    (set) => ({
      organizations: [],
      activeOrganization: null,
      integration: null,
      ownerUserId: null,
      hasHydrated: false,
      selectedWhatsAppPhoneNumberByOrg: {},
      setOrganizationOwner: (userId) => set({ ownerUserId: userId }),
      setOrganizations: (organizations) =>
        set((state) => {
          const activeOrganization = state.activeOrganization?._id
            ? organizations.find(
                (organization) =>
                  organization._id === state.activeOrganization?._id
              ) || null
            : null;

          if (typeof window !== "undefined" && !activeOrganization) {
            localStorage.removeItem("orgId");
          }

          return { organizations, activeOrganization };
        }),
      addOrganization: (organization) =>
        set((state) => ({
          organizations: [
            organization,
            ...state.organizations.filter((org) => org._id !== organization._id)
          ]
        })),
      upsertOrganization: (organization) =>
        set((state) => ({
          organizations: state.organizations.some(
            (org) => org._id === organization._id
          )
            ? state.organizations.map((org) =>
                org._id === organization._id ? organization : org
              )
            : [organization, ...state.organizations],
          activeOrganization:
            state.activeOrganization?._id === organization._id
              ? organization
              : state.activeOrganization
        })),
      setActiveOrganization: (organization) => {
        if (typeof window !== "undefined") {
          if (organization?._id) {
            localStorage.setItem("orgId", organization._id);
          } else {
            localStorage.removeItem("orgId");
          }
        }

        set({ activeOrganization: organization });
      },
      setIntegration: (integration) => set({ integration }),
      setSelectedWhatsAppPhoneNumber: (organizationId, phoneNumberId) =>
        set((state) => ({
          selectedWhatsAppPhoneNumberByOrg: {
            ...state.selectedWhatsAppPhoneNumberByOrg,
            [organizationId]: phoneNumberId
          }
        })),
      clearOrganizations: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("orgId");
        }

        set({
          organizations: [],
          activeOrganization: null,
          integration: null,
          ownerUserId: null,
          selectedWhatsAppPhoneNumberByOrg: {}
        });
      },
      setHasHydrated: (hasHydrated) => set({ hasHydrated })
    }),
    {
      name: "whatching-organizations",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        organizations: state.organizations,
        activeOrganization: state.activeOrganization,
        integration: state.integration,
        ownerUserId: state.ownerUserId,
        selectedWhatsAppPhoneNumberByOrg: state.selectedWhatsAppPhoneNumberByOrg
      }),
      onRehydrateStorage: () => (state) => {
        if (
          state &&
          !state.ownerUserId &&
          (state.activeOrganization || state.organizations.length)
        ) {
          state.clearOrganizations();
        }

        state?.setHasHydrated(true);
      }
    }
  )
);
