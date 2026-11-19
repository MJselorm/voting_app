import type { RouteObject } from "react-router-dom";
import { FeaturePlaceholder } from "../FeaturePlaceholder";

export const votingRoute: RouteObject = {
  path: "voting/*",
  element: (
    <FeaturePlaceholder
      title="Voting"
      description="Cryptographically verifiable secret ballot execution, voter credentials, and anonymous receipt generation."
    />
  ),
};
