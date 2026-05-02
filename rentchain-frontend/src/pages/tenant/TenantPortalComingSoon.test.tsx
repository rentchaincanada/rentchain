import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TenantPortalComingSoon from "./TenantPortalComingSoon";

describe("TenantPortalComingSoon", () => {
  it("shows tenant-safe unavailable copy without exposing environment flags", () => {
    render(<TenantPortalComingSoon />);

    expect(screen.getByText("Tenant portal coming soon")).toBeInTheDocument();
    expect(screen.getByText(/contact your landlord for details/i)).toBeInTheDocument();
    expect(screen.queryByText(/VITE_TENANT_PORTAL_ENABLED/i)).not.toBeInTheDocument();
  });
});
