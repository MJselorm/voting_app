import type { RouteObject } from "react-router-dom";
import { FeaturePlaceholder } from "../FeaturePlaceholder";

export const administrationRoute: RouteObject = {
  path: "administration/*",
  element: (
    <FeaturePlaceholder
      title="Administration"
      description="System-wide security, tenant provisioning, audit log exports, returning officer access, and compliance."
    />
  ),
};
