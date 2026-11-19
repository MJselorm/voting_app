import type { RouteObject } from "react-router-dom";
import { FeaturePlaceholder } from "../FeaturePlaceholder";

export const pollsRoute: RouteObject = {
  path: "polls/*",
  element: (
    <FeaturePlaceholder
      title="Polls & Surveys"
      description="Pulse sentiment, constitutional referendums, multi-option consultative inquiries, and instant feedback."
    />
  ),
};
