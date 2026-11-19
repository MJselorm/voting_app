import type { RouteObject } from "react-router-dom";
import { FeaturePlaceholder } from "../FeaturePlaceholder";

export const candidatesRoute: RouteObject = {
  path: "candidates/*",
  element: (
    <FeaturePlaceholder
      title="Candidates"
      description="Candidate nomination management, manifestos, endorsements, eligibility verification, and statements."
    />
  ),
};
