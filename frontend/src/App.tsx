import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute, PublicOnlyRoute, RoleProtectedRoute, dashboardPath } from "./auth/ProtectedRoute";

import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ProfilePage } from "./pages/ProfilePage";
import { StudentManagementPage } from "./pages/StudentManagementPage";
import { RoleDashboardPage } from "./pages/RoleDashboardPage";
import { useAuthContext } from "./auth/AuthContext";

import "./index.css";

export default function App() {
  return (
    <BrowserRouter>
      {/*
        AuthProvider wraps the entire app so every component can access
        authentication state via useAuth() without prop drilling.
      */}
      <AuthProvider>
        <Routes>
          {/* ── Public Routes ─────────────────────────────────────────────
              PublicOnlyRoute redirects already-authenticated users to /dashboard.
          ─────────────────────────────────────────────────────────────── */}
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnlyRoute>
                <RegisterPage />
              </PublicOnlyRoute>
            }
          />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          {/* ── Protected Routes ──────────────────────────────────────────
              ProtectedRoute requires:
                - User to be authenticated (Firebase)
                - Email to be verified (requireVerified=true by default)
          ─────────────────────────────────────────────────────────────── */}
          <Route path="/dashboard" element={<RoleProtectedRoute allowedRoles={["STUDENT"]}>
                <DashboardPage />
              </RoleProtectedRoute>} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route path="/official/dashboard" element={<RoleProtectedRoute allowedRoles={["ELECTION_OFFICIAL", "SUPER_ADMIN"]}><RoleDashboardPage role="ELECTION_OFFICIAL" /></RoleProtectedRoute>} />
          <Route path="/official/students" element={<RoleProtectedRoute allowedRoles={["ELECTION_OFFICIAL", "SUPER_ADMIN"]}><RoleDashboardPage role="ELECTION_OFFICIAL" page="Student Records"><StudentManagementPage /></RoleDashboardPage></RoleProtectedRoute>} />
          <Route path="/official/:page" element={<RoleProtectedRoute allowedRoles={["ELECTION_OFFICIAL", "SUPER_ADMIN"]}><RoleDashboardPage role="ELECTION_OFFICIAL" /></RoleProtectedRoute>} />
          <Route path="/admin/dashboard" element={<RoleProtectedRoute allowedRoles={["SUPER_ADMIN"]}><RoleDashboardPage role="SUPER_ADMIN" /></RoleProtectedRoute>} />
          <Route path="/admin/students" element={<RoleProtectedRoute allowedRoles={["SUPER_ADMIN"]}><RoleDashboardPage role="SUPER_ADMIN" page="Student Records"><StudentManagementPage /></RoleDashboardPage></RoleProtectedRoute>} />
          <Route path="/admin/:page" element={<RoleProtectedRoute allowedRoles={["SUPER_ADMIN"]}><RoleDashboardPage role="SUPER_ADMIN" /></RoleProtectedRoute>} />

          {/* ── Default Redirects ─────────────────────────────────────── */}
          <Route path="/" element={<HomeRedirect />} />
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

function HomeRedirect() {
  const { profile, isProfileLoading, status } = useAuthContext();
  if (status === "loading" || (status === "authenticated" && (isProfileLoading || !profile))) {
    return (
      <div className="auth-loading-screen">
        <div className="spinner" aria-label="Loading…" />
      </div>
    );
  }
  if (status === "emailNotVerified") {
    return <Navigate to="/verify-email" replace />;
  }
  if (status === "authenticated" && profile) {
    return <Navigate to={dashboardPath(profile.role)} replace />;
  }
  return <Navigate to="/login" replace />;
}
