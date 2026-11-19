import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

const DiscoverOrganizationsPage = lazy(() =>
  import("./pages/DiscoverOrganizationsPage").then((m) => ({
    default: m.DiscoverOrganizationsPage,
  })),
);

const MyOrganizationsPage = lazy(() =>
  import("./pages/MyOrganizationsPage").then((m) => ({
    default: m.MyOrganizationsPage,
  })),
);

const RequestOrganizationPage = lazy(() =>
  import("./pages/RequestOrganizationPage").then((m) => ({
    default: m.RequestOrganizationPage,
  })),
);

const OrganizationRequestsTrackingPage = lazy(() =>
  import("./pages/OrganizationRequestsTrackingPage").then((m) => ({
    default: m.OrganizationRequestsTrackingPage,
  })),
);

const OrganizationDetailsPage = lazy(() =>
  import("./pages/OrganizationDetailsPage").then((m) => ({
    default: m.OrganizationDetailsPage,
  })),
);

const OrganizationAdminPage = lazy(() =>
  import("./pages/OrganizationAdminPage").then((m) => ({
    default: m.OrganizationAdminPage,
  })),
);

export const organizationsRoute: RouteObject = {
  path: "organizations",
  children: [
    { index: true, element: <DiscoverOrganizationsPage /> },
    { path: "mine", element: <MyOrganizationsPage /> },
    { path: "request", element: <RequestOrganizationPage /> },
    { path: "requests", element: <OrganizationRequestsTrackingPage /> },
    { path: "admin", element: <OrganizationAdminPage /> },
    { path: ":id", element: <OrganizationDetailsPage /> },
  ],
};
