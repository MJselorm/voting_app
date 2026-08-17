import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  auth,
  onAuthStateChanged,
  type User,
} from "../lib/firebase";
import { getMe, syncUser, type UserProfile } from "../services/api";

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
  /** Store a profile loaded by an authentication flow immediately. */
  updateProfile: (profile: UserProfile) => void;
  /** Force refresh the application profile from the backend. */
  refreshProfile: () => Promise<UserProfile | null>;
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
  const profileRequestId = useRef(0);

  const deriveStatus = (firebaseUser: User | null): AuthStatus => {
    if (!firebaseUser) return "unauthenticated";
    if (!firebaseUser.emailVerified) return "emailNotVerified";
    return "authenticated";
  };

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setStatus("unauthenticated");
      setIsProfileLoading(false);
      return;
    }

    // Never leave the application on an invisible loading screen if a browser
    // extension or blocked Firebase request prevents the initial callback.
    const fallback = window.setTimeout(() => {
      setStatus((current) => {
        if (current === "loading") {
          setIsProfileLoading(false);
          return "unauthenticated";
        }
        return current;
      });
    }, 5000);

    // Subscribe to Firebase auth state.
    // Firebase calls this listener immediately with the current auth state.
    const firebaseAuth = auth;
    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      window.clearTimeout(fallback);
      const nextStatus = deriveStatus(firebaseUser);
      setUser(firebaseUser);
      setStatus(nextStatus);
      if (nextStatus === "authenticated") {
        // Set loading true immediately so route guards don't see a transient
        // state where status is authenticated but profile is null with isProfileLoading=false.
        setIsProfileLoading(true);
      } else {
        setIsProfileLoading(false);
      }
    }, () => {
      window.clearTimeout(fallback);
      setUser(null);
      setStatus("unauthenticated");
      setIsProfileLoading(false);
    });

    // Clean up the listener when the provider unmounts.
    return () => {
      window.clearTimeout(fallback);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++profileRequestId.current;
    if (status !== "authenticated" || !user) {
      setProfile(null);
      setIsProfileLoading(false);
      return;
    }

    setIsProfileLoading(true);
    const currentUser = user;

    // Load profile from FastAPI backend. If the account does not exist in PostgreSQL
    // yet (e.g. initial Google sign-in or after database wipe), auto-sync it.
    const loadProfile = async () => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 3 && !cancelled; attempt += 1) {
        try {
          const data = await getMe();
          if (!cancelled && profileRequestId.current === requestId) {
            setProfile(data);
            return;
          }
        } catch (error) {
          lastError = error;
          if (currentUser.email) {
            try {
              const syncRes = await syncUser({
                full_name: currentUser.displayName?.trim() || currentUser.email.split("@")[0] || "Student",
                email: currentUser.email,
              });
              if (!cancelled && profileRequestId.current === requestId) {
                setProfile(syncRes.user);
                return;
              }
            } catch (syncErr) {
              lastError = syncErr;
            }
          }
          if (attempt < 2) await new Promise<void>((resolve) => window.setTimeout(resolve, 350));
        }
      }
      console.error("Unable to load application profile:", lastError);
      if (!cancelled && profileRequestId.current === requestId) setProfile(null);
    };

    void loadProfile().finally(() => {
      if (!cancelled && profileRequestId.current === requestId) setIsProfileLoading(false);
    });

    return () => { cancelled = true; };
  }, [status, user]);

  /**
   * Reload the Firebase user to pick up the latest emailVerified state.
   * Call this after the user verifies their email and clicks "I've Verified".
   */
  const refreshUser = async (): Promise<void> => {
    if (auth?.currentUser) {
      await auth.currentUser.reload();
      const refreshed = auth.currentUser;
      const nextStatus = deriveStatus(refreshed);
      setUser(refreshed);
      setStatus(nextStatus);
      if (nextStatus === "authenticated") {
        setIsProfileLoading(true);
      }
    }
  };

  const updateProfile = (nextProfile: UserProfile): void => {
    profileRequestId.current += 1;
    setProfile(nextProfile);
    setIsProfileLoading(false);
  };

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    setIsProfileLoading(true);
    const requestId = ++profileRequestId.current;
    try {
      const data = await getMe();
      if (profileRequestId.current === requestId) {
        setProfile(data);
      }
      return data;
    } catch {
      if (user?.email) {
        try {
          const syncRes = await syncUser({
            full_name: user.displayName?.trim() || user.email.split("@")[0] || "Student",
            email: user.email,
          });
          if (profileRequestId.current === requestId) {
            setProfile(syncRes.user);
          }
          return syncRes.user;
        } catch {
          // ignore
        }
      }
      if (profileRequestId.current === requestId) {
        setProfile(null);
      }
      return null;
    } finally {
      if (profileRequestId.current === requestId) {
        setIsProfileLoading(false);
      }
    }
  }, [user]);

  const value: AuthContextValue = {
    user,
    status,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    profile,
    isProfileLoading,
    updateProfile,
    refreshProfile,
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
