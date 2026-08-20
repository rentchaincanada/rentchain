import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { activateLeaseDraft, createLeaseDraft, generateLeaseDraftPdf, updateLeaseDraft } from "@/api/leasePacksApi";
import { LeasePackWizardModal } from "./LeasePackWizardModal";

const mocks = vi.hoisted(() => ({ showToast: vi.fn() }));

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
  useToast: () => ({ showToast: mocks.showToast }),
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
    const activate = await screen.findByRole("button", { name: "Create Lease and Continue to Signing" });
    fireEvent.click(activate);
    expect(await screen.findByText("Failed to fetch")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create Lease and Continue to Signing" }));
    expect(await screen.findByText("conflict")).toBeInTheDocument();

    const firstKey = vi.mocked(activateLeaseDraft).mock.calls[0][1];
    expect(vi.mocked(activateLeaseDraft).mock.calls[1][1]).toBe(firstKey);
    fireEvent.change(screen.getByLabelText("Base rent (CAD)"), { target: { value: "2100" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Lease and Continue to Signing" }));
    await waitFor(() => expect(activateLeaseDraft).toHaveBeenCalledTimes(3));
    expect(vi.mocked(activateLeaseDraft).mock.calls[2][1]).not.toBe(firstKey);
  });

  it("presents lease creation as pending signing without implying execution or occupancy", async () => {
    vi.mocked(createLeaseDraft).mockResolvedValue({ ok: true, draftId: "draft-pending", draft: {} as any });
    vi.mocked(generateLeaseDraftPdf).mockResolvedValue({
      ok: true,
      snapshotId: "snapshot-pending",
      scheduleAUrl: "https://example.invalid/schedule-a.pdf",
    } as any);
    vi.mocked(activateLeaseDraft).mockResolvedValue({
      ok: true,
      leaseId: "lease-pending",
      lease: { status: "pending", occupancyEffective: false } as any,
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
    expect(await screen.findByText(/Schedule A is generated and ready for review/i)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Create Lease and Continue to Signing" }));

    expect(await screen.findByText("Pending signing")).toBeInTheDocument();
    expect(screen.getByText("Lease record created. Signing is still required, and occupancy has not begun.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue to signing" })).toHaveAttribute(
      "href",
      "/leases?view=pending-signing&leaseId=lease-pending"
    );
    expect(screen.queryByText(/fully executed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/occupancy started/i)).not.toBeInTheDocument();
  });

  it("coalesces duplicate lease-creation clicks while one request is in flight", async () => {
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
    const activate = await screen.findByRole("button", { name: "Create Lease and Continue to Signing" });
    fireEvent.click(activate);
    fireEvent.click(activate);
    expect(activateLeaseDraft).toHaveBeenCalledTimes(1);
    resolveActivation({ ok: true, leaseId: "lease-1", lease: { status: "pending", occupancyEffective: false } });
    expect(await screen.findByText("Pending signing")).toBeInTheDocument();
  });

  it("keeps successful lease creation terminal after the component settles", async () => {
    vi.mocked(createLeaseDraft).mockResolvedValue({ ok: true, draftId: "draft-1", draft: {} as any });
    vi.mocked(generateLeaseDraftPdf).mockResolvedValue({ ok: true, snapshotId: "snapshot-1", scheduleAUrl: "https://example.invalid/schedule-a.pdf" } as any);
    vi.mocked(activateLeaseDraft).mockResolvedValue({
      ok: true,
      leaseId: "lease-1",
      lease: { id: "lease-1", status: "pending", occupancyEffective: false } as any,
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
    fireEvent.click(await screen.findByRole("button", { name: "Create Lease and Continue to Signing" }));
    expect(await screen.findByText("Pending signing")).toBeInTheDocument();
    const completed = screen.getByRole("button", { name: "Lease Created" });
    expect(completed).toBeDisabled();
    fireEvent.click(completed);

    expect(activateLeaseDraft).toHaveBeenCalledTimes(1);
    expect(mocks.showToast).toHaveBeenCalledTimes(1);
  });

  it("allows a newly generated draft after a different draft completed lease creation", async () => {
    vi.mocked(createLeaseDraft)
      .mockResolvedValueOnce({ ok: true, draftId: "draft-1", draft: {} as any })
      .mockResolvedValueOnce({ ok: true, draftId: "draft-2", draft: {} as any });
    vi.mocked(generateLeaseDraftPdf)
      .mockResolvedValueOnce({ ok: true, snapshotId: "snapshot-1", scheduleAUrl: "https://example.invalid/schedule-a-1.pdf" } as any)
      .mockResolvedValueOnce({ ok: true, snapshotId: "snapshot-2", scheduleAUrl: "https://example.invalid/schedule-a-2.pdf" } as any);
    vi.mocked(updateLeaseDraft).mockResolvedValue({} as any);
    vi.mocked(activateLeaseDraft).mockResolvedValue({ ok: true, leaseId: "lease-1", lease: { status: "pending", occupancyEffective: false } as any });
    const props = {
      onClose: vi.fn(),
      landlordName: "Landlord",
      tenant: { id: "tenant-1", fullName: "Tenant One", propertyId: "property-1", propertyName: "Harbour Place", unitId: "unit-1", unit: "1", province: "NS" },
      lease: { startDate: "2026-09-01", endDate: "2027-08-31", monthlyRent: 2000 },
    };
    const { rerender } = render(<LeasePackWizardModal open {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /Generate Schedule A PDF/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Create Lease and Continue to Signing" }));
    expect(await screen.findByRole("button", { name: "Lease Created" })).toBeDisabled();
    rerender(<LeasePackWizardModal open={false} {...props} />);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Lease Created" })).not.toBeInTheDocument());
    rerender(<LeasePackWizardModal open {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Generate Schedule A PDF/i }));

    expect(await screen.findByRole("button", { name: "Create Lease and Continue to Signing" })).toBeEnabled();
    expect(screen.getByText(/Draft: draft-2/)).toBeInTheDocument();
  });
});
