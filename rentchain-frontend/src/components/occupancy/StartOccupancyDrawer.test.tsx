import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StartOccupancyDrawer } from "./StartOccupancyDrawer";

const getOccupancyStartContextMock = vi.fn();
const startOccupancyMock = vi.fn();

vi.mock("@/api/occupancyStartApi", () => ({
  getOccupancyStartContext: (...args: unknown[]) => getOccupancyStartContextMock(...args),
  startOccupancy: (...args: unknown[]) => startOccupancyMock(...args),
}));

const context = {
  leaseId: "lease-1",
  propertyId: "property-1",
  unitId: "unit-1",
  leaseStartDate: "2026-08-01",
  leaseEndDate: "2027-07-31",
  participants: [{ tenantId: "tenant-1", displayName: "Taylor Tenant" }],
  executionStatus: "fully_executed",
  termStatus: "current",
  currentOccupancyState: "not_occupancy_effective",
  eligible: true,
  expectedStateToken: "state-1",
  evaluationInstant: "2026-08-24T12:00:00.000Z",
  canonicalBlocker: null,
  availableAction: "start_occupancy" as const,
};

describe("StartOccupancyDrawer", () => {
  beforeEach(() => {
    getOccupancyStartContextMock.mockReset().mockResolvedValue({ ok: true, context });
    startOccupancyMock.mockReset().mockResolvedValue({ ok: true, result: {} });
  });
  afterEach(cleanup);

  it("shows authoritative tenant, property, unit, lease, execution, and occupancy context", async () => {
    render(<StartOccupancyDrawer leaseId="lease-1" propertyLabel="Harbour House" unitLabel="Unit 4B" onClose={vi.fn()} onStarted={vi.fn()} />);

    expect(await screen.findByText("Taylor Tenant")).toBeInTheDocument();
    expect(screen.getByText("Harbour House / Unit 4B")).toBeInTheDocument();
    expect(screen.getByText("2026-08-01 – 2027-07-31")).toBeInTheDocument();
    expect(screen.getByText("fully_executed")).toBeInTheDocument();
    expect(screen.getByText("current")).toBeInTheDocument();
    expect(screen.getByText("not occupancy effective")).toBeInTheDocument();
  });

  it("cannot submit until possession is confirmed", async () => {
    const onStarted = vi.fn();
    render(<StartOccupancyDrawer leaseId="lease-1" onClose={vi.fn()} onStarted={onStarted} />);
    const submit = await screen.findByRole("button", { name: "Confirm and Start Occupancy" });
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(startOccupancyMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() => expect(startOccupancyMock).toHaveBeenCalledWith("lease-1", expect.objectContaining({
      expectedStateToken: "state-1",
      evaluationInstant: "2026-08-24T12:00:00.000Z",
    })));
    expect(onStarted).toHaveBeenCalledTimes(1);
  });

  it("renders authoritative blockers without enabling the command", async () => {
    getOccupancyStartContextMock.mockResolvedValueOnce({ ok: true, context: { ...context, eligible: false, canonicalBlocker: "renewal_handoff_required", availableAction: null } });
    render(<StartOccupancyDrawer leaseId="lease-1" onClose={vi.fn()} onStarted={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("renewal_handoff_required");
    expect(screen.getByRole("button", { name: "Confirm and Start Occupancy" })).toBeDisabled();
  });

  it("fails closed when authoritative context cannot be loaded", async () => {
    getOccupancyStartContextMock.mockRejectedValueOnce(new Error("unavailable"));
    render(<StartOccupancyDrawer leaseId="lease-1" onClose={vi.fn()} onStarted={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No occupancy changes were made");
    expect(screen.getByRole("button", { name: "Confirm and Start Occupancy" })).toBeDisabled();
  });
});
