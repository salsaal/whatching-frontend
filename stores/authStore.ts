import { AuthUser } from "@/api/types/auth.type";
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
        if (typeof window !== "undefined") {
          localStorage.setItem("accessToken", token);
        }

        set({
          token,
          user,
          isAuthenticated: true
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
      setUser: (user) => set({ user }),
      logout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("orgId");
        }

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
