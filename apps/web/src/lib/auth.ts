import type {
  AuthMeResponse,
  AuthResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from "@conecta-agenda/types";

import { apiFetch } from "./api";

export const AUTH_TOKEN_KEY = "conecta_agenda_token";

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  businessName?: string;
  whatsapp?: string;
};

export function getStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function storeToken(token: string) {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearStoredToken() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function loginRequest(payload: LoginPayload) {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function registerRequest(payload: RegisterPayload) {
  return apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function meRequest(token: string) {
  return apiFetch<AuthMeResponse>("/auth/me", {
    token,
  });
}

export function forgotPasswordRequest(payload: ForgotPasswordRequest) {
  return apiFetch<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function resetPasswordRequest(payload: ResetPasswordRequest) {
  return apiFetch<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
