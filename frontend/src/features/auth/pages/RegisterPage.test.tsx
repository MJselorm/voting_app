import { fireEvent, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { RegisterPage } from "./RegisterPage";
import { makeAuthContextValue, renderWithAuth } from "../test-utils";

describe("RegisterPage", () => {
  it("rejects mismatched password confirmation", async () => {
    const register = vi.fn();
    renderWithAuth(
      <MemoryRouter>
        <Routes><Route path="/" element={<RegisterPage />} /></Routes>
      </MemoryRouter>,
      makeAuthContextValue({ register }),
    );

    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Test Person" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "person@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "different" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("creates an account and continues to verification", async () => {
    const register = vi.fn(async () => undefined);
    renderWithAuth(
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<p>Check your email</p>} />
        </Routes>
      </MemoryRouter>,
      makeAuthContextValue({ register }),
    );

    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Test Person" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "person@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(register).toHaveBeenCalledWith("Test Person", "person@example.com", "password123");
  });
});
