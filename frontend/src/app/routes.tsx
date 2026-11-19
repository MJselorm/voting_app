import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, useRoutes } from "react-router-dom";

import { PublicLayout } from "./layouts/PublicLayout";
import { AppShell } from "../components/navigation/AppShell";
import { LoadingState } from "../components/shared/LoadingState";
import { ProtectedRoute } from "../features/auth/components/ProtectedRoute";

import { organizationsRoute } from "../features/organizations/routes";
import { electionsRoute } from "../features/elections/routes";
import { candidatesRoute } from "../features/candidates/routes";
import { votingRoute } from "../features/voting/routes";
import { pollsRoute } from "../features/polls/routes";
import { resultsRoute } from "../features/results/routes";
import { administrationRoute } from "../features/administration/routes";

// Lazy-loaded visual pages
const LandingPage = lazy(() =>
  import("../pages/LandingPage").then((m) => ({ default: m.LandingPage })),
);
const DashboardPreviewPage = lazy(() =>
  import("../pages/DashboardPreviewPage").then((m) => ({
    default: m.DashboardPreviewPage,
  })),
);
const NotFoundPage = lazy(() =>
  import("../pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })),
);

// Optional auth pages (lazy-loaded to preserve functionality without blocking public/app access)
const LoginPage = lazy(() =>
  import("../features/auth/pages/LoginPage").then((m) => ({
    default: m.LoginPage,
  })),
);
const RegisterPage = lazy(() =>
  import("../features/auth/pages/RegisterPage").then((m) => ({
    default: m.RegisterPage,
  })),
);
const ForgotPasswordPage = lazy(() =>
  import("../features/auth/pages/ForgotPasswordPage").then((m) => ({
    default: m.ForgotPasswordPage,
  })),
);
const VerifyEmailPage = lazy(() =>
  import("../features/auth/pages/VerifyEmailPage").then((m) => ({
    default: m.VerifyEmailPage,
  })),
);
const ProfilePage = lazy(() =>
  import("../features/auth/pages/ProfilePage").then((m) => ({
    default: m.ProfilePage,
  })),
);

function withSuspense(page: ReactNode) {
  return (
    <Suspense fallback={<LoadingState label="Loading workspace..." />}>
      {page}
    </Suspense>
  );
}

export function AppRoutes() {
  return useRoutes([
    // 1. Public Layout Routes
    {
      element: <PublicLayout />,
      children: [
        { path: "/", element: withSuspense(<LandingPage />) },
        { path: "/login", element: withSuspense(<LoginPage />) },
        { path: "/register", element: withSuspense(<RegisterPage />) },
        { path: "/forgot-password", element: withSuspense(<ForgotPasswordPage />) },
        { path: "/verify-email", element: withSuspense(<VerifyEmailPage />) },
      ],
    },

    // 2. Authenticated Application Shell Routes
    {
      element: <ProtectedRoute />,
      children: [
        {
          path: "/app",
          element: <AppShell />,
          children: [
            { index: true, element: withSuspense(<DashboardPreviewPage />) },
            { path: "profile", element: withSuspense(<ProfilePage />) },
            organizationsRoute,
            electionsRoute,
            candidatesRoute,
            votingRoute,
            pollsRoute,
            resultsRoute,
            administrationRoute,
          ],
        },
      ],
    },

    // 3. Not Found Route
    {
      element: <PublicLayout />,
      children: [
        { path: "/404", element: withSuspense(<NotFoundPage />) },
        { path: "*", element: <Navigate to="/404" replace /> },
      ],
    },
  ]);
}
