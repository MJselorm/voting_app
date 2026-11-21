import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  currentUser: { getIdToken: vi.fn(async () => "firebase-token") },
  signOut: vi.fn(async () => undefined),
}));

vi.mock("./firebase", () => ({ getFirebaseAuth: () => state }));
vi.mock("firebase/auth", () => ({ signOut: state.signOut }));

import { apiRequest } from "./api-client";

afterEach(() => vi.unstubAllGlobals());

describe("API client", () => {
  it("attaches Firebase ID tokens to REST calls", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer firebase-token");
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    }));

    await expect(apiRequest("/api/health")).resolves.toEqual({ status: "ok" });
  });

  it("supports successful no-content responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));

    await expect(apiRequest<void>("/api/v1/admin/role-assignment/test", {
      method: "DELETE",
    })).resolves.toBeUndefined();
  });

  it("ends the local session on unauthorized responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ detail: "Invalid session." }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    )));

    await expect(apiRequest("/api/auth/me")).rejects.toMatchObject({
      status: 401,
      message: "Invalid session.",
    });
    expect(state.signOut).toHaveBeenCalled();
  });
});
