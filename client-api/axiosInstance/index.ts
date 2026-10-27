import axios from "axios";
import { AuthUser } from "@/client-api/types/auth.type";
import { useAuthStore } from "@/stores/authStore";
import { useOrganizationStore } from "@/stores/organizationStore";
import { AUTH_ENDPOINTS } from "../endpoints";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  withCredentials: true
});

let refreshTokenRequest: Promise<string> | null = null;

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

const refreshAccessToken = async () => {
  if (!refreshTokenRequest) {
    refreshTokenRequest = axios
      .post(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}${AUTH_ENDPOINTS.REFRESH_TOKEN}`,
        {},
        { withCredentials: true }
      )
      .then((res) => {
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

        return newToken;
      })
      .finally(() => {
        refreshTokenRequest = null;
      });
  }

  return refreshTokenRequest;
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

  if (process.env.NEXT_PUBLIC_API_BASE_URL?.includes("ngrok-free.app")) {
    config.headers["ngrok-skip-browser-warning"] = "true";
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
    // A wrong current password on /update-password is also a 401, but the
    // session is fine -- renewing the token and retrying would only repeat
    // the same answer. An expired token on that route still renews normally,
    // so this keys on the backend's specific message, not just the URL.
    const isWrongCurrentPassword =
      originalRequest.url?.includes(AUTH_ENDPOINTS.UPDATE_PASSWORD) &&
      error.response?.data?.message === "Current password is incorrect.";

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthRoute &&
      !isWrongCurrentPassword
    ) {
      originalRequest._retry = true;

      try {
        const newToken = await refreshAccessToken();

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
