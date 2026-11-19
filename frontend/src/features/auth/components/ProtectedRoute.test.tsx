import { screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ProtectedRoute } from "./ProtectedRoute";
import { makeAuthContextValue, renderWithAuth } from "../test-utils";

describe("ProtectedRoute", () => {
  function renderRoutes(context: ReturnType<typeof makeAuthContextValue>) {
    return renderWithAuth(
      <MemoryRouter initialEntries={["/private"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/private" element={<p>Private account page</p>} />
          </Route>
          <Route path="/login" element={<p>Sign-in page</p>} />
          <Route path="/verify-email" element={<p>Verification page</p>} />
        </Routes>
      </MemoryRouter>,
      context,
    );
  }

  it("shows loading state during session restoration", () => {
    renderRoutes(makeAuthContextValue({ loading: true }));
    expect(screen.getByRole("status")).toHaveTextContent("Restoring your session");
  });

  it("redirects signed-out or unverified users", () => {
    const signedOut = renderRoutes(makeAuthContextValue({ user: null }));
    expect(screen.getByText("Sign-in page")).toBeInTheDocument();
    signedOut.unmount();

    renderRoutes(makeAuthContextValue({ emailVerified: false }));
    expect(screen.getByText("Verification page")).toBeInTheDocument();
  });

  it("renders a protected page for a verified user", () => {
    renderRoutes(makeAuthContextValue());
    expect(screen.getByText("Private account page")).toBeInTheDocument();
  });
});
