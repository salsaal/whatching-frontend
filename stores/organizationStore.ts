import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface OrganizationMetaConfig {
  status?: "pending" | "ready" | "failed" | string;
  businessAccountName?: string;
  connectedAt?: string;
  displayPhoneNumber?: string;
  lastHealthCheckAt?: string;
  phoneNumberId?: string;
  wabaId?: string;
}

export interface OrganizationUsage {
  aiTokensUsed: number;
  subscribersCount: number;
}

export interface Organization {
  _id: string;
  name: string;
  slug: string;
  planTier: string;
  subscriptionStatus: string;
  walletBalance: number;
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
  hasHydrated: boolean;
  setOrganizations: (organizations: Organization[]) => void;
  addOrganization: (organization: Organization) => void;
  upsertOrganization: (organization: Organization) => void;
  setActiveOrganization: (organization: Organization | null) => void;
  setIntegration: (integration: IntegrationStatus | null) => void;
  clearOrganizations: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useOrganizationStore = create<OrganizationState>()(
  persist(
    (set) => ({
      organizations: [],
      activeOrganization: null,
      integration: null,
      hasHydrated: false,
      setOrganizations: (organizations) => set({ organizations }),
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
      clearOrganizations: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("orgId");
        }

        set({
          organizations: [],
          activeOrganization: null,
          integration: null
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
        integration: state.integration
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      }
    }
  )
);
