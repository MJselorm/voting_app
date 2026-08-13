import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  auth,
  onAuthStateChanged,
  type User,
} from "../lib/firebase";
import { getMe, type UserProfile } from "../services/api";

// ── Auth State Types ──────────────────────────────────────────────────────────

export type AuthStatus =
  | "loading"           // Initial state — Firebase is determining auth state
  | "unauthenticated"   // No user signed in
  | "emailNotVerified"  // Signed in but email not yet verified
  | "authenticated";    // Fully signed in and verified

export interface AuthContextValue {
  /** The current Firebase user object, or null if not authenticated. */
  user: User | null;
  /** The current authentication status. */
  status: AuthStatus;
  /** Convenience: true only when status === "authenticated" */
  isAuthenticated: boolean;
  /** Convenience: true while Firebase is resolving the initial auth state */
  isLoading: boolean;
  /** Application profile returned by the API, including the authoritative role. */
  profile: UserProfile | null;
  /** True while the application profile is being loaded. */
  isProfileLoading: boolean;
  /**
   * Re-checks the current user's email verification status.
   * Call this after the user clicks "I've Verified" on the verification page.
   */
  refreshUser: () => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  const deriveStatus = (firebaseUser: User | null): AuthStatus => {
    if (!firebaseUser) return "unauthenticated";
    if (!firebaseUser.emailVerified) return "emailNotVerified";
    return "authenticated";
  };

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setStatus("unauthenticated");
      return;
    }

    // Subscribe to Firebase auth state.
    // Firebase calls this listener immediately with the current auth state.
    const firebaseAuth = auth;
    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      setUser(firebaseUser);
      setStatus(deriveStatus(firebaseUser));
    });

    // Clean up the listener when the provider unmounts.
    return unsubscribe;
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (status !== "authenticated") {
      setProfile(null);
      setIsProfileLoading(false);
      return;
    }

    setIsProfileLoading(true);
    getMe()
      .then((data) => { if (!cancelled) setProfile(data); })
      .catch((error) => {
        // Route guards handle an unavailable application account by returning
        // the user to login instead of trusting a client-side default role.
        console.error("Unable to load application profile:", error);
        if (!cancelled) setProfile(null);
      })
      .finally(() => { if (!cancelled) setIsProfileLoading(false); });

    return () => { cancelled = true; };
  }, [status]);

  /**
   * Reload the Firebase user to pick up the latest emailVerified state.
   * Call this after the user verifies their email and clicks "I've Verified".
   */
  const refreshUser = async (): Promise<void> => {
    if (auth?.currentUser) {
      await auth.currentUser.reload();
      const refreshed = auth.currentUser;
      setUser(refreshed);
      setStatus(deriveStatus(refreshed));
    }
  };

  const value: AuthContextValue = {
    user,
    status,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    profile,
    isProfileLoading,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Access the authentication context.
 * Must be used inside an <AuthProvider>.
 */
export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return ctx;
}
