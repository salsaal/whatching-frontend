import { AuthUser } from "@/client-api/types/auth.type";
import { useOrganizationStore } from "@/stores/organizationStore";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  hasHydrated: boolean;
  isAuthenticated: boolean;
  // The backend dedupes a free trial by owner phone number and email across
  // every organisation that owner has ever created, not per-organisation --
  // so once a 409 confirms this user has already used their one trial, we
  // remember it here (persisted, per-user) instead of making them rediscover
  // the same error on every future organisation they create.
  trialUnavailable: boolean;
  setAuth: (payload: { token: string; user: AuthUser }) => void;
  setToken: (token: string) => void;
  setUser: (user: AuthUser | null) => void;
  markTrialUnavailable: () => void;
  logout: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      hasHydrated: false,
      isAuthenticated: false,
      trialUnavailable: false,
      setAuth: ({ token, user }) => {
        const organizationStore = useOrganizationStore.getState();
        const hasOrganizationState =
          Boolean(organizationStore.activeOrganization) ||
          organizationStore.organizations.length > 0;
        const hasDifferentUser =
          Boolean(organizationStore.ownerUserId) &&
          organizationStore.ownerUserId !== user._id;
        const hasUnknownOrganizationOwner =
          hasOrganizationState && !organizationStore.ownerUserId;

        if (typeof window !== "undefined") {
          localStorage.setItem("accessToken", token);
        }

        if (hasDifferentUser || hasUnknownOrganizationOwner) {
          organizationStore.clearOrganizations();
        }

        useOrganizationStore.getState().setOrganizationOwner(user._id);

        set((state) => {
          const isDifferentUser =
            state.user?._id && state.user._id !== user._id;
          if (isDifferentUser) {
            useOrganizationStore.getState().clearOrganizations();
            useOrganizationStore.getState().setOrganizationOwner(user._id);
          }

          return {
            token,
            user,
            isAuthenticated: true,
            trialUnavailable: isDifferentUser ? false : state.trialUnavailable
          };
        });
      },
      setToken: (token) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("accessToken", token);
        }

        set({
          token,
          isAuthenticated: true
        });
      },
      setUser: (user) => {
        if (user?._id) {
          useOrganizationStore.getState().setOrganizationOwner(user._id);
        }

        set({ user });
      },
      markTrialUnavailable: () => set({ trialUnavailable: true }),
      logout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("orgId");
        }

        useOrganizationStore.getState().clearOrganizations();

        set({
          token: null,
          user: null,
          isAuthenticated: false,
          trialUnavailable: false
        });
      },
      setHasHydrated: (hasHydrated) => set({ hasHydrated })
    }),
    {
      name: "whatching-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        trialUnavailable: state.trialUnavailable
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      }
    }
  )
);
