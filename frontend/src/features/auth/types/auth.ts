export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  email_verified: boolean;
  is_platform_super_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthContextValue {
  user: import("firebase/auth").User | null;
  loading: boolean;
  emailVerified: boolean;
  profileLoading: boolean;
  profileError: string | null;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<import("firebase/auth").User>;
  loginWithGoogle: () => Promise<import("firebase/auth").User>;
  logout: () => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshEmailVerification: () => Promise<boolean>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (fullName: string) => Promise<UserProfile>;
  deleteAccount: (password?: string) => Promise<void>;
}
