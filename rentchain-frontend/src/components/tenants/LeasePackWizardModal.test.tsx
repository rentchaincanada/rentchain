import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LeasePackWizardModal } from "./LeasePackWizardModal";

vi.mock("@/api/leasePacksApi", () => ({
  activateLeaseDraft: vi.fn(),
  createLeaseDraft: vi.fn(),
  generateLeaseDraftPdf: vi.fn(),
  getLeaseSnapshot: vi.fn(),
  updateLeaseDraft: vi.fn(),
}));

vi.mock("@/api/http", () => ({
  apiJson: vi.fn(async () => ({ items: [] })),
}));

vi.mock("../ui/ToastProvider", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("@/components/leases/LeaseRiskCard", () => ({
  LeaseRiskCard: () => null,
}));

describe("LeasePackWizardModal jurisdiction workflow guidance", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders Nova Scotia jurisdiction badge and workflow guidance", () => {
    render(
      <LeasePackWizardModal
        open
        onClose={vi.fn()}
        landlordName="Landlord"
        tenant={{
          id: "tenant-1",
          fullName: "Tenant One",
          propertyId: "property-1",
          propertyName: "Harbour Place",
          unitId: "unit-1",
          unit: "1",
          province: "NS",
        }}
        lease={{}}
      />
    );

    expect(screen.getByText("NS Residential")).toBeInTheDocument();
    expect(screen.getByText("Workflow guidance only - verify local legal requirements.")).toBeInTheDocument();
    expect(screen.getByText(/standard residential ns form p/i)).toBeInTheDocument();
  });

  it("renders Ontario jurisdiction badge without enabling Schedule A generation", () => {
    render(
      <LeasePackWizardModal
        open
        onClose={vi.fn()}
        landlordName="Landlord"
        tenant={{
          id: "tenant-1",
          fullName: "Tenant One",
          propertyId: "property-1",
          propertyName: "King Street",
          unitId: "unit-1",
          unit: "1",
          province: "ON",
        }}
        lease={{}}
      />
    );

    expect(screen.getByText("ON Residential")).toBeInTheDocument();
    expect(screen.getByText(/Ontario lease pack documents are available/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Generate Schedule A PDF/i })).not.toBeInTheDocument();
  });
});
