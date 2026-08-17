import { Navigate, useLocation } from "react-router-dom";
import { useAuthContext } from "./AuthContext";
import type { ReactNode } from "react";
import type { UserProfile } from "../services/api";
import { logoutUser } from "../lib/firebase";

interface ProtectedRouteProps {
  children: ReactNode;
  /** If true, the route also requires email verification. Default: true */
  requireVerified?: boolean;
}

interface RoleProtectedRouteProps extends ProtectedRouteProps {
  allowedRoles: UserProfile["role"][];
}

/**
 * ProtectedRoute
 *
 * Wraps any route that requires authentication.
 * - Unauthenticated users → redirect to /login
 * - Authenticated but unverified users → redirect to /verify-email
 * - Authenticated + verified users → render children
 */
export function ProtectedRoute({
  children,
  requireVerified = true,
}: ProtectedRouteProps) {
  const { status, isProfileLoading } = useAuthContext();
  const location = useLocation();

  if (status === "loading" || (status === "authenticated" && isProfileLoading)) {
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
 * (login, register) to their role's dashboard.
 */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { status, profile, isProfileLoading } = useAuthContext();

  if (status === "loading" || (status === "authenticated" && (isProfileLoading || !profile))) {
    return (
      <div className="auth-loading-screen">
        <div className="spinner" aria-label="Loading…" />
      </div>
    );
  }

  if (status === "authenticated" && profile) {
    return <Navigate to={dashboardPath(profile.role)} replace />;
  }

  return <>{children}</>;
}

export function dashboardPath(role?: UserProfile["role"]): string {
  if (role === "ELECTION_OFFICIAL") return "/official/dashboard";
  if (role === "SUPER_ADMIN") return "/admin/dashboard";
  return "/dashboard";
}

/** UI guard only. The API remains responsible for authorization decisions. */
export function RoleProtectedRoute({ children, allowedRoles, requireVerified = true }: RoleProtectedRouteProps) {
  const { status, profile, isProfileLoading, refreshProfile } = useAuthContext();
  const location = useLocation();

  if (status === "loading" || (status === "authenticated" && isProfileLoading)) {
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

  if (!profile) {
    return (
      <div className="auth-profile-error-container">
        <div className="auth-profile-error-card">
          <div className="auth-profile-error-icon" aria-hidden="true">⚠️</div>
          <h2>Profile Unavailable</h2>
          <p>Your account profile could not be loaded. Please ensure the voting API backend is running, then try again.</p>
          <div className="auth-profile-error-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => { void refreshProfile(); }}
            >
              Retry
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { void logoutUser(); }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to={dashboardPath(profile.role)} replace />;
  }

  return <>{children}</>;
}
