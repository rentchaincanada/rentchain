import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import TenantLandingPage from "./TenantLandingPage";

describe("TenantLandingPage", () => {
  it("renders tenant-first copy and avoids landlord pricing language", () => {
    render(
      <MemoryRouter>
        <TenantLandingPage />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/Your rental profile\. Secure, organized, and in your control\./i)
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Log in \/ Continue/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Create free account/i)).not.toBeInTheDocument();
  });
});
