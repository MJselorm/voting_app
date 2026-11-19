import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AuthContext } from "../AuthProvider";
import { makeAuthContextValue, testProfile } from "../test-utils";
import { ProfilePage } from "./ProfilePage";

vi.mock("../services/authApi", () => ({
  deleteCurrentAccount: vi.fn(async () => ({ message: "deleted" })),
  getCurrentProfile: vi.fn(async () => testProfile),
  syncCurrentUser: vi.fn(async () => testProfile),
  updateCurrentProfile: vi.fn(async (fullName: string) => ({ ...testProfile, full_name: fullName })),
}));

function renderProfile(authValue = makeAuthContextValue()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={["/app/profile"]}>
          <Routes>
            <Route path="/app/profile" element={<ProfilePage />} />
            <Route path="/" element={<p>Public landing page</p>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("ProfilePage", () => {
  it("loads the server profile and saves a validated name", async () => {
    const updateProfile = vi.fn(async (fullName: string) => ({ ...testProfile, full_name: fullName }));
    renderProfile(makeAuthContextValue({ updateProfile }));

    expect(await screen.findByDisplayValue("person@example.com")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Updated Person" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith("Updated Person"));
    expect(await screen.findByRole("status")).toHaveTextContent("Your profile has been updated.");
  });

  it("validates the name before submitting an update", async () => {
    const updateProfile = vi.fn();
    renderProfile(makeAuthContextValue({ updateProfile }));
    await screen.findByDisplayValue("person@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Enter a name between 2 and 120 characters.")).toBeInTheDocument();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("displays backend errors when profile updates fail", async () => {
    const updateProfile = vi.fn(async () => {
      throw new Error("Profile service unavailable.");
    });
    renderProfile(makeAuthContextValue({ updateProfile }));
    await screen.findByDisplayValue("person@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Updated Person" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Profile service unavailable.");
  });

  it("requires typed confirmation and a password before deleting, then redirects", async () => {
    const deleteAccount = vi.fn(async () => undefined);
    renderProfile(makeAuthContextValue({ deleteAccount }));
    await screen.findByDisplayValue("person@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));

    const deleteButton = screen.getByRole("button", { name: "Reauthenticate and delete" });
    expect(deleteButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Type DELETE to continue"), { target: { value: "DELETE" } });
    expect(deleteButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "password123" } });
    fireEvent.click(deleteButton);

    await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith("password123"));
    expect(await screen.findByText("Public landing page")).toBeInTheDocument();
  });

  it("shows a deletion failure without claiming the account was removed", async () => {
    const deleteAccount = vi.fn(async () => {
      throw new Error("Firebase deletion failed; profile restored.");
    });
    renderProfile(makeAuthContextValue({ deleteAccount }));
    await screen.findByDisplayValue("person@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    fireEvent.change(screen.getByLabelText("Type DELETE to continue"), { target: { value: "DELETE" } });
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Reauthenticate and delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Firebase deletion failed; profile restored.");
    expect(screen.queryByText("Public landing page")).not.toBeInTheDocument();
  });
});
