import { useAuthContext } from "../auth/AuthContext";

/**
 * useAuth
 *
 * Convenience hook for accessing auth state throughout the application.
 * Reads from the centralized AuthContext — do not access AuthContext directly
 * in components; use this hook instead.
 *
 * @example
 * const { user, isAuthenticated, status } = useAuth();
 */
export function useAuth() {
  return useAuthContext();
}
