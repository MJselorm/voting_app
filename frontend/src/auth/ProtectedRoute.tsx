import { Navigate, useLocation } from "react-router-dom";
import { useAuthContext } from "./AuthContext";
import type { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  /** If true, the route also requires email verification. Default: true */
  requireVerified?: boolean;
}

/**
 * ProtectedRoute
 *
 * Wraps any route that requires authentication.
 * - Unauthenticated users → redirect to /login
 * - Authenticated but unverified users → redirect to /verify-email
 * - Authenticated + verified users → render children
 *
 * The current path is preserved in location state so the user can be
 * redirected back after login.
 */
export function ProtectedRoute({
  children,
  requireVerified = true,
}: ProtectedRouteProps) {
  const { status } = useAuthContext();
  const location = useLocation();

  if (status === "loading") {
    // Show nothing (or a spinner) while Firebase resolves the auth state.
    return (
      <div className="auth-loading-screen">
        <div className="spinner" aria-label="Loading…" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireVerified && status === "emailNotVerified") {
    return <Navigate to="/verify-email" replace />;
  }

  return <>{children}</>;
}

/**
 * PublicOnlyRoute
 *
 * Redirects authenticated users away from public-only pages
 * (login, register) to the dashboard.
 */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { status } = useAuthContext();

  if (status === "loading") {
    return (
      <div className="auth-loading-screen">
        <div className="spinner" aria-label="Loading…" />
      </div>
    );
  }

  if (status === "authenticated") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
