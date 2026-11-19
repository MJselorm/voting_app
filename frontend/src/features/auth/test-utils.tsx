import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

import { AuthContext } from "./AuthProvider";
import type { AuthContextValue, UserProfile } from "./types/auth";

export const testProfile: UserProfile = {
  id: "profile-1",
  full_name: "Test Person",
  email: "person@example.com",
  is_active: true,
  email_verified: true,
  is_platform_super_admin: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const user = {
  uid: "firebase-user-1",
  email: "person@example.com",
  emailVerified: true,
  providerData: [{ providerId: "password" }],
} as AuthContextValue["user"];

export function makeAuthContextValue(
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  return {
    user,
    loading: false,
    emailVerified: true,
    profileLoading: false,
    profileError: null,
    register: async () => undefined,
    login: async () => user!,
    loginWithGoogle: async () => user!,
    logout: async () => undefined,
    resendVerification: async () => undefined,
    refreshEmailVerification: async () => true,
    resetPassword: async () => undefined,
    refreshProfile: async () => undefined,
    updateProfile: async (fullName) => ({ ...testProfile, full_name: fullName }),
    deleteAccount: async () => undefined,
    ...overrides,
  };
}

export function renderWithAuth(
  ui: ReactNode,
  authValue: AuthContextValue = makeAuthContextValue(),
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>{ui}</AuthContext.Provider>
    </QueryClientProvider>,
  );
}
