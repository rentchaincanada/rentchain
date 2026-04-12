import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import TenantLandingPage from "./TenantLandingPage";
import { TENANT_DEFAULT_DESTINATION } from "../../lib/authDestination";

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

  it("keeps tenant CTAs inside the tenant auth flow", () => {
    render(
      <MemoryRouter>
        <TenantLandingPage />
      </MemoryRouter>
    );

    const loginLinks = screen.getAllByRole("link", { name: /Log in \/ Continue/i });
    for (const link of loginLinks) {
      expect(link).toHaveAttribute(
        "href",
        `/tenant/login?next=${encodeURIComponent(TENANT_DEFAULT_DESTINATION)}`
      );
    }

    const getStartedLinks = screen.getAllByRole("link", { name: /Get started/i });
    for (const link of getStartedLinks) {
      expect(link).toHaveAttribute(
        "href",
        `/tenant/login?next=${encodeURIComponent(TENANT_DEFAULT_DESTINATION)}&intent=create-profile`
      );
    }
  });
});
