import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { activateLeaseDraft, createLeaseDraft, generateLeaseDraftPdf } from "@/api/leasePacksApi";
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
    vi.clearAllMocks();
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

  it("blocks lease pack generation when the start date is after the end date", () => {
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
        lease={{ startDate: "2026-09-01", endDate: "2026-08-31", monthlyRent: 2000 }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Generate Schedule A PDF/i }));

    expect(screen.getByText("Lease start date must be on or before the end date.")).toBeInTheDocument();
    expect(createLeaseDraft).not.toHaveBeenCalled();
  });

  it("reuses an activation key after uncertain transport failure and rotates after a terminal response", async () => {
    vi.mocked(createLeaseDraft).mockResolvedValue({ ok: true, draftId: "draft-1", draft: {} as any });
    vi.mocked(generateLeaseDraftPdf).mockResolvedValue({ ok: true, snapshotId: "snapshot-1", scheduleAUrl: "https://example.invalid/schedule-a.pdf" } as any);
    vi.mocked(activateLeaseDraft)
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(Object.assign(new Error("conflict"), { status: 409 }))
      .mockResolvedValueOnce({ ok: true, leaseId: "lease-1", lease: {} as any, occupancyOutcome: "occupancy_effective" });
    render(
      <LeasePackWizardModal
        open
        onClose={vi.fn()}
        landlordName="Landlord"
        tenant={{ id: "tenant-1", fullName: "Tenant One", propertyId: "property-1", propertyName: "Harbour Place", unitId: "unit-1", unit: "1", province: "NS" }}
        lease={{ startDate: "2026-09-01", endDate: "2027-08-31", monthlyRent: 2000 }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Generate Schedule A PDF/i }));
    const activate = await screen.findByRole("button", { name: "Activate Lease" });
    fireEvent.click(activate);
    expect(await screen.findByText("Failed to fetch")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Activate Lease" }));
    expect(await screen.findByText("conflict")).toBeInTheDocument();

    const firstKey = vi.mocked(activateLeaseDraft).mock.calls[0][1];
    expect(vi.mocked(activateLeaseDraft).mock.calls[1][1]).toBe(firstKey);
    fireEvent.change(screen.getByLabelText("Base rent (CAD)"), { target: { value: "2100" } });
    fireEvent.click(screen.getByRole("button", { name: "Activate Lease" }));
    await waitFor(() => expect(activateLeaseDraft).toHaveBeenCalledTimes(3));
    expect(vi.mocked(activateLeaseDraft).mock.calls[2][1]).not.toBe(firstKey);
  });

  it.each([
    ["created_without_occupancy", "Pending occupancy", "future-start automation is not enabled"],
    ["occupancy_effective", "Current occupancy", "Canonical occupancy is effective"],
  ] as const)("presents %s activation without conflating lease creation and occupancy", async (occupancyOutcome, label, description) => {
    vi.mocked(createLeaseDraft).mockResolvedValue({ ok: true, draftId: "draft-1", draft: {} as any });
    vi.mocked(generateLeaseDraftPdf).mockResolvedValue({ ok: true, snapshotId: "snapshot-1", scheduleAUrl: "https://example.invalid/schedule-a.pdf" } as any);
    vi.mocked(activateLeaseDraft).mockResolvedValue({
      ok: true,
      leaseId: "lease-1",
      lease: { id: "lease-1", startDate: "2026-09-01" } as any,
      occupancyOutcome,
    });
    render(
      <LeasePackWizardModal
        open
        onClose={vi.fn()}
        landlordName="Landlord"
        tenant={{ id: "tenant-1", fullName: "Tenant One", propertyId: "property-1", propertyName: "Harbour Place", unitId: "unit-1", unit: "1", province: "NS" }}
        lease={{ startDate: "2026-09-01", endDate: "2027-08-31", monthlyRent: 2000 }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Generate Schedule A PDF/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Activate Lease" }));

    expect(await screen.findByText(label)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(description, "i"))).toBeInTheDocument();
  });

  it("coalesces duplicate activation clicks while one request is in flight", async () => {
    vi.mocked(createLeaseDraft).mockResolvedValue({ ok: true, draftId: "draft-1", draft: {} as any });
    vi.mocked(generateLeaseDraftPdf).mockResolvedValue({ ok: true, snapshotId: "snapshot-1", scheduleAUrl: "https://example.invalid/schedule-a.pdf" } as any);
    let resolveActivation!: (value: any) => void;
    vi.mocked(activateLeaseDraft).mockImplementation(() => new Promise((resolve) => { resolveActivation = resolve; }));
    render(
      <LeasePackWizardModal
        open
        onClose={vi.fn()}
        landlordName="Landlord"
        tenant={{ id: "tenant-1", fullName: "Tenant One", propertyId: "property-1", propertyName: "Harbour Place", unitId: "unit-1", unit: "1", province: "NS" }}
        lease={{ startDate: "2026-09-01", endDate: "2027-08-31", monthlyRent: 2000 }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Generate Schedule A PDF/i }));
    const activate = await screen.findByRole("button", { name: "Activate Lease" });
    fireEvent.click(activate);
    fireEvent.click(activate);
    expect(activateLeaseDraft).toHaveBeenCalledTimes(1);
    resolveActivation({ ok: true, leaseId: "lease-1", lease: {}, occupancyOutcome: "created_without_occupancy" });
    expect(await screen.findByText("Pending occupancy")).toBeInTheDocument();
  });
});
