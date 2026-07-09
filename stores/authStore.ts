import { AuthUser } from "@/api/types/auth.type";
import { useOrganizationStore } from "@/stores/organizationStore";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  hasHydrated: boolean;
  isAuthenticated: boolean;
  setAuth: (payload: { token: string; user: AuthUser }) => void;
  setToken: (token: string) => void;
  setUser: (user: AuthUser | null) => void;
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
          if (state.user?._id && state.user._id !== user._id) {
            useOrganizationStore.getState().clearOrganizations();
            useOrganizationStore.getState().setOrganizationOwner(user._id);
          }

          return {
            token,
            user,
            isAuthenticated: true
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
      logout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("orgId");
        }

        useOrganizationStore.getState().clearOrganizations();

        set({
          token: null,
          user: null,
          isAuthenticated: false
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
        isAuthenticated: state.isAuthenticated
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      }
    }
  )
);
