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
