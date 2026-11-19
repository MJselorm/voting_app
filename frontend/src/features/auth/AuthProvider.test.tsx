import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

const mocks = vi.hoisted(() => ({
  listener: null as null | ((user: unknown) => void),
  initialUser: null as unknown,
  auth: { currentUser: null as unknown },
  signOut: vi.fn(async () => undefined),
  reauthenticateWithCredential: vi.fn(async () => undefined),
  reauthenticateWithPopup: vi.fn(async () => undefined),
  deleteCurrentAccount: vi.fn(async () => ({ message: "deleted" })),
  updateCurrentProfile: vi.fn(async (fullName: string) => ({
    id: "profile-1",
    full_name: fullName,
    email: "person@example.com",
    is_active: true,
    email_verified: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  })),
  updateFirebaseProfile: vi.fn(async () => undefined),
  syncCurrentUser: vi.fn(async () => ({
    id: "profile-1",
    full_name: "Test Person",
    email: "person@example.com",
    is_active: true,
    email_verified: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  })),
}));

vi.mock("../../lib/firebase", () => ({ getFirebaseAuth: () => mocks.auth }));
vi.mock("./services/authApi", () => ({
  deleteCurrentAccount: mocks.deleteCurrentAccount,
  syncCurrentUser: mocks.syncCurrentUser,
  updateCurrentProfile: mocks.updateCurrentProfile,
}));
vi.mock("firebase/auth", () => ({
  EmailAuthProvider: {
    PROVIDER_ID: "password",
    credential: vi.fn((email: string, password: string) => ({ email, password })),
  },
  GoogleAuthProvider: class {
    static PROVIDER_ID = "google.com";
  },
  browserLocalPersistence: {},
  createUserWithEmailAndPassword: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, callback: (user: unknown) => void) => {
    mocks.listener = callback;
    queueMicrotask(() => callback(mocks.initialUser));
    return vi.fn();
  }),
  reload: vi.fn(async () => undefined),
  reauthenticateWithCredential: mocks.reauthenticateWithCredential,
  reauthenticateWithPopup: mocks.reauthenticateWithPopup,
  sendEmailVerification: vi.fn(async () => undefined),
  sendPasswordResetEmail: vi.fn(async () => undefined),
  setPersistence: vi.fn(async () => undefined),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: mocks.signOut,
  updateProfile: mocks.updateFirebaseProfile,
}));

import type { User as FirebaseUser } from "firebase/auth";

import { AuthProvider } from "./AuthProvider";
import { useAuth } from "./hooks/useAuth";

function firebaseUser() {
  return {
    uid: "firebase-user-1",
    email: "person@example.com",
    emailVerified: true,
    providerData: [{ providerId: "password" }],
    getIdToken: vi.fn(async () => "id-token"),
  } as unknown as FirebaseUser;
}

function SessionProbe() {
  const { user, loading, logout, deleteAccount, updateProfile } = useAuth();
  const [deleteError, setDeleteError] = useState("");
  return (
    <div>
      <span>{loading ? "loading" : user ? "signed-in" : "signed-out"}</span>
      <button onClick={() => void logout()} type="button">Sign out</button>
      <button onClick={() => void deleteAccount("password123").catch((error: Error) => setDeleteError(error.message))} type="button">Delete account</button>
      <button onClick={() => void updateProfile("Updated Person")} type="button">Update profile</button>
      {deleteError && <p role="alert">{deleteError}</p>}
    </div>
  );
}

function renderProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider><SessionProbe /></AuthProvider>
    </QueryClientProvider>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    mocks.listener = null;
    mocks.initialUser = firebaseUser();
    mocks.auth.currentUser = mocks.initialUser;
    mocks.syncCurrentUser.mockClear();
    mocks.deleteCurrentAccount.mockClear();
    mocks.reauthenticateWithCredential.mockClear();
    mocks.reauthenticateWithPopup.mockClear();
    mocks.updateCurrentProfile.mockClear();
    mocks.updateFirebaseProfile.mockClear();
    mocks.signOut.mockClear();
    mocks.signOut.mockImplementation(async () => {
      mocks.auth.currentUser = null;
      mocks.listener?.(null);
    });
  });

  it("restores a Firebase session and syncs its profile through the query cache", async () => {
    render(renderProvider());
    expect(await screen.findByText("signed-in")).toBeInTheDocument();
    expect(mocks.syncCurrentUser).toHaveBeenCalled();
  });

  it("clears the session after logout", async () => {
    render(renderProvider());
    await screen.findByText("signed-in");
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(screen.getByText("signed-out")).toBeInTheDocument());
  });

  it("reauthenticates before deleting and signs out after backend success", async () => {
    render(renderProvider());
    await screen.findByText("signed-in");
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));

    await waitFor(() => expect(mocks.deleteCurrentAccount).toHaveBeenCalledOnce());
    expect(mocks.reauthenticateWithCredential).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByText("signed-out")).toBeInTheDocument());
  });

  it("uses Google reauthentication for Google-only accounts", async () => {
    mocks.initialUser = {
      ...firebaseUser(),
      providerData: [{ providerId: "google.com" }],
    };
    mocks.auth.currentUser = mocks.initialUser;
    render(renderProvider());
    await screen.findByText("signed-in");
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));

    await waitFor(() => expect(mocks.reauthenticateWithPopup).toHaveBeenCalledOnce());
    expect(mocks.deleteCurrentAccount).toHaveBeenCalledOnce();
  });

  it("keeps the session when the backend refuses account deletion", async () => {
    mocks.deleteCurrentAccount.mockRejectedValueOnce(new Error("Neon profile was retained."));
    render(renderProvider());
    await screen.findByText("signed-in");
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Neon profile was retained.");
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(screen.getByText("signed-in")).toBeInTheDocument();
  });

  it("persists profile changes to FastAPI and mirrors the display name to Firebase", async () => {
    render(renderProvider());
    await screen.findByText("signed-in");
    fireEvent.click(screen.getByRole("button", { name: "Update profile" }));

    await waitFor(() => expect(mocks.updateCurrentProfile).toHaveBeenCalledWith("Updated Person"));
    expect(mocks.updateFirebaseProfile).toHaveBeenCalledWith(
      mocks.initialUser,
      { displayName: "Updated Person" },
    );
  });
});
