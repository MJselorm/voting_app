import type { RouteObject } from "react-router-dom";
import { FeaturePlaceholder } from "../FeaturePlaceholder";

export const electionsRoute: RouteObject = {
  path: "elections/*",
  element: (
    <FeaturePlaceholder
      title="Elections"
      description="Election setup, candidate nominations, voting models (STV, FPTP, Ranked), timeline scheduling, and quorums."
    />
  ),
};
