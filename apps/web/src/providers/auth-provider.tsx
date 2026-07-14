"use client";

import type { AuthBusiness, AuthUser } from "@conecta-agenda/types";
import type { AuthResponse } from "@conecta-agenda/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  clearStoredToken,
  getStoredToken,
  loginRequest,
  meRequest,
  registerRequest,
  storeToken,
  type LoginPayload,
  type RegisterPayload,
} from "@/lib/auth";

type AuthContextValue = {
  user: AuthUser | null;
  business: AuthBusiness | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<AuthResponse>;
  register: (payload: RegisterPayload) => Promise<AuthResponse>;
  refreshMe: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [business, setBusiness] = useState<AuthBusiness | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setSession = useCallback(
    (nextToken: string, nextUser: AuthUser, nextBusiness: AuthBusiness) => {
      storeToken(nextToken);
      setToken(nextToken);
      setUser(nextUser);
      setBusiness(nextBusiness);
    },
    [],
  );

  const logout = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setUser(null);
    setBusiness(null);
  }, []);

  useEffect(() => {
    const storedToken = getStoredToken();

    if (!storedToken) {
      setLoading(false);
      return;
    }

    setToken(storedToken);

    meRequest(storedToken)
      .then((response) => {
        setUser(response.user);
        setBusiness(response.business);
      })
      .catch(() => {
        logout();
      })
      .finally(() => {
        setLoading(false);
      });
  }, [logout]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const response = await loginRequest(payload);
      setSession(response.token, response.user, response.business);
      return response;
    },
    [setSession],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const response = await registerRequest(payload);
      setSession(response.token, response.user, response.business);
      return response;
    },
    [setSession],
  );

  const refreshMe = useCallback(async () => {
    const activeToken = token ?? getStoredToken();

    if (!activeToken) {
      return;
    }

    const response = await meRequest(activeToken);
    setToken(activeToken);
    setUser(response.user);
    setBusiness(response.business);
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      business,
      token,
      loading,
      isAuthenticated: Boolean(token && user && business),
      login,
      register,
      refreshMe,
      logout,
    }),
    [business, loading, login, logout, refreshMe, register, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuthContext deve ser usado dentro de AuthProvider.");
  }

  return context;
}
