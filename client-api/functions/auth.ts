import api from "../axiosInstance";
import { AUTH_ENDPOINTS } from "../endpoints";
import { ApiResponse } from "../types/api";
import {
  LoginResponse,
  MeResponse,
  ResetPasswordResponse,
  SignupPayload,
  VerifyResponse
} from "../types/auth.type";

// 🔥 SIGNUP
export const signupUser = async (
  payload: SignupPayload
): Promise<ApiResponse> => {
  const res = await api.post("/users/signup", payload);
  return res.data;
};

export const verifyEmail = async (token: string): Promise<VerifyResponse> => {
  const res = await api.get<VerifyResponse>(
    `${AUTH_ENDPOINTS.VERIFY_EMAIL}/${token}`
  );

  return res.data;
};

export const resendVerification = async (payload: {
  email: string;
}): Promise<ApiResponse> => {
  const res = await api.post<ApiResponse>(
    AUTH_ENDPOINTS.RESEND_VERIFICATION,
    payload
  );
  return res.data;
};

export const loginUser = async (payload: {
  email: string;
  password: string;
}): Promise<LoginResponse> => {
  const res = await api.post<LoginResponse>(AUTH_ENDPOINTS.LOGIN, payload);

  return res.data;
};

export const getMe = async (): Promise<MeResponse> => {
  const res = await api.get<MeResponse>(AUTH_ENDPOINTS.ME);
  return res.data;
};

export const forgotPassword = async (payload: {
  email: string;
}): Promise<ApiResponse> => {
  const res = await api.post<ApiResponse>(
    AUTH_ENDPOINTS.FORGOT_PASSWORD,
    payload
  );

  return res.data;
};

export const resetPassword = async ({
  token,
  payload
}: {
  token: string;
  payload: {
    password: string;
    passwordConfirm: string;
  };
}): Promise<ResetPasswordResponse> => {
  const res = await api.patch<ResetPasswordResponse>(
    `${AUTH_ENDPOINTS.RESET_PASSWORD}/${token}`,
    payload
  );

  return res.data;
};

// Revokes the refresh token server-side. The axios instance already sends
// credentials, but this call only matters because of the httpOnly cookie,
// so it's stated explicitly here.
export const logoutUser = async (): Promise<ApiResponse> => {
  const res = await api.post<ApiResponse>(AUTH_ENDPOINTS.LOGOUT, undefined, {
    withCredentials: true
  });
  return res.data;
};

export const updatePassword = async (payload: {
  currentPassword: string;
  password: string;
  passwordConfirm: string;
}): Promise<LoginResponse> => {
  const res = await api.patch<LoginResponse>(
    AUTH_ENDPOINTS.UPDATE_PASSWORD,
    payload
  );
  return res.data;
};
