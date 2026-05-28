export interface SignupPayload {
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
  passwordConfirm: string;
}

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  phoneNumber: string;
  isVerified: boolean;
  createdAt?: string;
  updatedAt?: string;
  passwordChangedAt?: string;
  __v?: number;
}

export interface SignupResponse {
  status: string;
  message: string;
}

export interface VerifyResponse {
  status: string;
  message?: string;
  token: string;
  data: {
    user: {
      _id: string;
      name: string;
      email: string;
      phoneNumber: string;
      isVerified: boolean;
    };
  };
}

export interface LoginResponse {
  status: string;
  token: string;
  data: {
    user: {
      _id: string;
      name: string;
      email: string;
      phoneNumber: string;
      isVerified: boolean;
    };
  };
}

export interface ResetPasswordResponse {
  status: string;
  token: string;
  data: {
    user: {
      _id: string;
      name: string;
      email: string;
      phoneNumber: string;
      isVerified: boolean;
    };
  };
}

export interface MeResponse {
  status: string;
  data: {
    user: AuthUser;
  };
}
