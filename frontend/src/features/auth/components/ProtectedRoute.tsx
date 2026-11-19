import { Navigate, Outlet } from "react-router-dom";

import { LoadingScreen } from "../../../components/shared/LoadingScreen";
import { useAuth } from "../hooks/useAuth";

export function ProtectedRoute({ allowUnverified = false }: { allowUnverified?: boolean }) {
  const { user, loading, emailVerified } = useAuth();
  if (loading) return <LoadingScreen label="Restoring your session…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!emailVerified && !allowUnverified) return <Navigate to="/verify-email" replace />;
  if (emailVerified && allowUnverified) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
