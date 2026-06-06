import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ScreeningConsentPage from "./ScreeningConsent";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  grant: vi.fn(),
  list: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock("../../context/useAuth", () => ({ useAuth: mocks.useAuth }));
vi.mock("../../api/providerNeutralScreeningApi", () => ({
  grantScreeningConsent: mocks.grant,
  listScreeningConsents: mocks.list,
  revokeScreeningConsent: mocks.revoke,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ScreeningConsentPage", () => {
  beforeEach(() => {
    mocks.useAuth.mockReturnValue({ user: { id: "tenant-1", tenantId: "tenant-1", role: "tenant" } });
    mocks.list.mockResolvedValue({ ok: true, consents: [] });
    mocks.grant.mockResolvedValue({
      ok: true,
      consent: {
        consentId: "consent-1",
        tenantId: "tenant-1",
        landlordId: "landlord-1",
        unitId: "unit-1",
        status: "active",
        grantedAt: "now",
        revokedAt: null,
      },
    });
  });

  it("grants screening consent when scope references are present", async () => {
    render(
      <MemoryRouter initialEntries={["/tenant/screening/consent?landlordId=landlord-1&unitId=unit-1"]}>
        <ScreeningConsentPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Grant consent" }));

    await waitFor(() => expect(mocks.grant).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      landlordId: "landlord-1",
      unitId: "unit-1",
    }));
    expect(await screen.findByText(/Consent granted/)).toBeInTheDocument();
  });
});
