import { beforeEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/api-client", () => ({ apiRequest }));

import {
  deleteCurrentAccount,
  getCurrentProfile,
  updateCurrentProfile,
} from "./authApi";

describe("profile API", () => {
  beforeEach(() => apiRequest.mockClear());

  it("uses the current-user endpoint for reads and updates", () => {
    getCurrentProfile();
    updateCurrentProfile("Updated Person");

    expect(apiRequest).toHaveBeenNthCalledWith(1, "/api/v1/users/me");
    expect(apiRequest).toHaveBeenNthCalledWith(2, "/api/v1/users/me", {
      method: "PATCH",
      body: JSON.stringify({ full_name: "Updated Person" }),
    });
  });

  it("requests permanent account deletion through the authenticated API client", () => {
    deleteCurrentAccount();

    expect(apiRequest).toHaveBeenCalledWith("/api/v1/users/me", {
      method: "DELETE",
    });
  });
});
