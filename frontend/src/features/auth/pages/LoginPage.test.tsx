import { fireEvent, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { LoginPage } from "./LoginPage";
import { makeAuthContextValue, renderWithAuth } from "../test-utils";

describe("LoginPage", () => {
  it("validates credentials before calling Firebase", async () => {
    const login = vi.fn();
    renderWithAuth(
      <MemoryRouter>
        <Routes><Route path="/" element={<LoginPage />} /></Routes>
      </MemoryRouter>,
      makeAuthContextValue({ login }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("shows Firebase credential errors", async () => {
    const login = vi.fn(async () => {
      throw { code: "auth/invalid-credential" };
    });
    renderWithAuth(
      <MemoryRouter>
        <Routes><Route path="/" element={<LoginPage />} /></Routes>
      </MemoryRouter>,
      makeAuthContextValue({ login }),
    );

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "person@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.");
  });
});
