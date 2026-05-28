import axios from "axios";
import { AuthUser } from "@/api/types/auth.type";
import { useAuthStore } from "@/stores/authStore";
import { useOrganizationStore } from "@/stores/organizationStore";
import { AUTH_ENDPOINTS } from "../endpoints";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  withCredentials: true
});

const getAccessTokenFromResponse = (data: unknown): string | null => {
  if (!data || typeof data !== "object") return null;

  const response = data as {
    accessToken?: string;
    token?: string;
    data?: {
      accessToken?: string;
      token?: string;
    };
  };

  return (
    response.accessToken ||
    response.token ||
    response.data?.accessToken ||
    response.data?.token ||
    null
  );
};

const getUserFromResponse = (data: unknown): AuthUser | null => {
  if (!data || typeof data !== "object") return null;

  const response = data as {
    data?: {
      user?: AuthUser;
    };
  };

  return response.data?.user || null;
};

// 🔥 REQUEST INTERCEPTOR
api.interceptors.request.use((config) => {
  const authState = useAuthStore.getState();
  const organizationState = useOrganizationStore.getState();
  const token =
    authState.token ||
    (typeof window !== "undefined"
      ? localStorage.getItem("accessToken")
      : null);
  const orgId =
    organizationState.activeOrganization?._id ||
    (typeof window !== "undefined" ? localStorage.getItem("orgId") : null);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (orgId) {
    config.headers["x-org-id"] = orgId;
  }

  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    // 🔥 skip refresh for auth routes
    const isAuthRoute =
      originalRequest.url?.includes("/login") ||
      originalRequest.url?.includes("/signup") ||
      originalRequest.url?.includes("/refresh-token");

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthRoute
    ) {
      originalRequest._retry = true;

      try {
        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}${AUTH_ENDPOINTS.REFRESH_TOKEN}`,
          {},
          { withCredentials: true }
        );

        const newToken = getAccessTokenFromResponse(res.data);

        if (!newToken) {
          throw new Error(
            "Refresh token response did not include access token"
          );
        }

        const refreshedUser = getUserFromResponse(res.data);

        if (refreshedUser) {
          useAuthStore.getState().setAuth({
            token: newToken,
            user: refreshedUser
          });
        } else {
          useAuthStore.getState().setToken(newToken);
        }

        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        return api(originalRequest);
      } catch {
        useAuthStore.getState().logout();
        useOrganizationStore.getState().clearOrganizations();

        if (typeof window !== "undefined") {
          window.location.href = "/auth/login";
        }

        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
