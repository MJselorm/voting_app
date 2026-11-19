import type { RouteObject } from "react-router-dom";
import { FeaturePlaceholder } from "../FeaturePlaceholder";

export const resultsRoute: RouteObject = {
  path: "results/*",
  element: (
    <FeaturePlaceholder
      title="Results & Tabulation"
      description="Live participation metrics, STV stage calculations, cryptographic tally audits, and official declarations."
    />
  ),
};
