import React, { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResolveOccupancyDrawer } from "./ResolveOccupancyDrawer";

const { getContext, submit } = vi.hoisted(() => ({ getContext: vi.fn(), submit: vi.fn() }));
vi.mock("@/api/occupancyResolutionApi", async () => {
  const actual = await vi.importActual<any>("@/api/occupancyResolutionApi");
  return { ...actual, getOccupancyResolutionContext: getContext, submitOccupancyResolution: submit };
});

const context = {
  propertyId: "property-1",
  unitId: "unit-1",
  tenantId: "tenant-1",
  propertyLabel: "Harbour House",
  unitLabel: "1A",
  canonicalState: { leaseTermState: "past", occupancyState: "review_needed", tenantRelationshipState: "occupancy_unresolved", supportingLeaseId: null, reasons: ["PAST_LEASE_CANNOT_SUPPORT_OCCUPANCY", "OCCUPIED_WITHOUT_CURRENT_LEASE"] },
  expectedStateToken: "token-1",
  eligibleResolutionTypes: ["record_operational_move_out", "clear_stale_occupancy_record"],
  existingLeaseCandidates: [],
  activeLeaseRequiresEndWorkflow: false,
  contextMismatchRemediation: { classification: "not_applicable", repairEligible: false, authoritativeLeaseId: null, blockedReason: null, mismatchedComponents: [], staleLinkageFields: [] },
};

function DrawerHarness({ removeTriggerOnResolve = false }: { removeTriggerOnResolve?: boolean }) {
  const [open, setOpen] = useState(false);
  const [resolved, setResolved] = useState(false);
  return (
    <main aria-label="Occupancy workspace">
      {!resolved ? <button type="button" onClick={() => setOpen(true)}>Resolve occupancy</button> : null}
      <ResolveOccupancyDrawer
        open={open}
        propertyId="property-1"
        unitId="unit-1"
        tenantId="tenant-1"
        onClose={() => setOpen(false)}
        onResolved={() => { if (removeTriggerOnResolve) setResolved(true); }}
      />
    </main>
  );
}

describe("ResolveOccupancyDrawer", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    getContext.mockReset().mockResolvedValue({ ok: true, context });
    submit.mockReset().mockResolvedValue({ ok: true, context: { ...context, canonicalState: { ...context.canonicalState, occupancyState: "vacant" } } });
  });

  it("uses neutral confirmation language and requires an effective date", async () => {
    render(<ResolveOccupancyDrawer open propertyId="property-1" unitId="unit-1" tenantId="tenant-1" onClose={vi.fn()} />);
    expect(await screen.findByRole("dialog", { name: "Resolve Occupancy" })).toBeInTheDocument();
    expect(screen.getByText(/without making a legal tenancy determination/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Record operational move-out"));
    expect(screen.getByRole("button", { name: "Confirm operational reconciliation" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Operational move-out effective date"), { target: { value: "2026-08-18" } });
    expect(screen.getByRole("button", { name: "Confirm operational reconciliation" })).toBeEnabled();
  });

  it("shows the bounded authoritative lease and requires explicit stale-link reconciliation", async () => {
    getContext.mockResolvedValueOnce({ ok: true, context: {
      ...context,
      canonicalState: { ...context.canonicalState, leaseTermState: "active", reasons: ["CURRENT_LEASE_CONTEXT_MISMATCH", "VACANT_WITH_CURRENT_LEASE"] },
      eligibleResolutionTypes: ["reconcile_stale_occupancy_linkage"],
      contextMismatchRemediation: { classification: "stale_occupancy_linkage_with_unique_authoritative_lease", repairEligible: true, authoritativeLeaseId: "lease-current", blockedReason: null, mismatchedComponents: ["occupancy_linkage"], staleLinkageFields: ["unit.currentLeaseId", "tenant.currentLeaseId"] },
      existingLeaseCandidates: [{ id: "lease-current", reference: "Lease A1B2C3D4", label: "Harbour House · Unit 1A", tenantId: "tenant-1", participantNames: ["Tenant One"], participantCount: 1, startDate: "2026-01-01", endDate: "2027-01-01", executionStatus: "fully_executed", occupancyEffective: true, activeTenancyCount: 1 }],
    } });
    render(<ResolveOccupancyDrawer open propertyId="property-1" unitId="unit-1" tenantId="tenant-1" onClose={vi.fn()} />);
    expect(await screen.findByText("Lease and occupancy links don't match")).toBeInTheDocument();
    expect(screen.getByText("Lease A1B2C3D4")).toBeInTheDocument();
    expect(screen.getByText(/Lease property, unit, and participant terms will not change/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Correct occupancy links"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm operational reconciliation" }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ type: "reconcile_stale_occupancy_linkage" })));
  });

  it.each([
    ["lease_context_mismatch", "This lease belongs to a different unit and cannot be corrected here."],
    ["participant_mismatch", "The requested tenant is not a participant on the authoritative lease."],
    ["ambiguous_context", "More than one record could represent the current occupancy."],
  ])("explains non-repairable %s without a mutation action", async (classification, blockedReason) => {
    getContext.mockResolvedValueOnce({ ok: true, context: {
      ...context,
      canonicalState: { ...context.canonicalState, reasons: ["CURRENT_LEASE_CONTEXT_MISMATCH"] },
      eligibleResolutionTypes: [],
      contextMismatchRemediation: { classification, repairEligible: false, authoritativeLeaseId: null, blockedReason, mismatchedComponents: [], staleLinkageFields: [] },
    } });
    render(<ResolveOccupancyDrawer open propertyId="property-1" unitId="unit-1" tenantId="tenant-1" onClose={vi.fn()} />);
    expect(await screen.findByText("This mismatch cannot be corrected here")).toBeInTheDocument();
    expect(screen.getByText(blockedReason)).toBeInTheDocument();
    expect(screen.queryByLabelText("Correct occupancy links")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm operational reconciliation" })).not.toBeInTheDocument();
  });

  it("shows every conflicting lease with no default and requires explicit selection plus acknowledgement", async () => {
    getContext.mockResolvedValueOnce({
      ok: true,
      context: {
        ...context,
        tenantId: null,
        canonicalState: { ...context.canonicalState, leaseTermState: "active", reasons: ["MULTIPLE_CURRENT_LEASES"] },
        eligibleResolutionTypes: ["resolve_multiple_current_leases"],
        existingLeaseCandidates: [
          { id: "lease-a", reference: "Lease A1B2C3D4", label: "Harbour House · Unit 1A", tenantId: "tenant-1", participantNames: ["Tenant One"], participantCount: 1, startDate: "2026-01-01", endDate: "2027-01-01", executionStatus: "fully_executed", occupancyEffective: true, activeTenancyCount: 1 },
          { id: "lease-b", reference: "Lease E5F6A7B8", label: "Harbour House · Unit 1A", tenantId: "tenant-2", participantNames: ["Tenant Two"], participantCount: 1, startDate: "2026-02-01", endDate: "2027-02-01", executionStatus: "fully_executed", occupancyEffective: true, activeTenancyCount: 1 },
        ],
      },
    });
    render(<ResolveOccupancyDrawer open propertyId="property-1" unitId="unit-1" onClose={vi.fn()} />);
    fireEvent.click(await screen.findByLabelText("Select the lease that supports current occupancy"));
    expect(screen.getAllByRole("radio", { name: /Lease option/ })).toHaveLength(2);
    expect(screen.getByRole("radio", { name: /Lease option 1/ })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: /Lease option 2/ })).not.toBeChecked();
    expect(screen.getByText("Tenant One")).toBeInTheDocument();
    expect(screen.getByText("Tenant Two")).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Confirm operational reconciliation" });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /Lease option 2/ }));
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/does not by itself determine the legal validity or termination/i));
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ type: "resolve_multiple_current_leases", selectedLeaseId: "lease-b" })));
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("keeps the workflow open and refreshes context after a stale-state response", async () => {
    submit.mockRejectedValue(Object.assign(new Error("stale"), { body: { error: "occupancy_state_stale", freshContext: { ...context, expectedStateToken: "token-2" } } }));
    render(<ResolveOccupancyDrawer open propertyId="property-1" unitId="unit-1" tenantId="tenant-1" onClose={vi.fn()} />);
    fireEvent.click(await screen.findByLabelText("Correct stale occupancy records"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm operational reconciliation" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/changed while this review was open/i);
    expect(alert).not.toHaveTextContent("occupancy_state_stale");
    expect(screen.getByRole("dialog", { name: "Resolve Occupancy" })).toBeInTheDocument();
  });

  it("shows bounded review guidance for ambiguous embedded unit records", async () => {
    submit.mockRejectedValue(Object.assign(new Error("ambiguous"), { body: { error: "embedded_unit_ambiguous" } }));
    render(<ResolveOccupancyDrawer open propertyId="property-1" unitId="unit-1" tenantId="tenant-1" onClose={vi.fn()} />);
    fireEvent.click(await screen.findByLabelText("Correct stale occupancy records"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm operational reconciliation" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The occupancy records for this unit do not match cleanly. Review the unit and lease records before trying again.");
    expect(alert).not.toHaveTextContent("embedded_unit_ambiguous");
  });

  it("uses bounded generic copy for an unknown occupancy error identifier", async () => {
    submit.mockRejectedValue(Object.assign(new Error("unknown"), { body: { error: "synthetic_unknown_occupancy_error" } }));
    render(<ResolveOccupancyDrawer open propertyId="property-1" unitId="unit-1" tenantId="tenant-1" onClose={vi.fn()} />);
    fireEvent.click(await screen.findByLabelText("Correct stale occupancy records"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm operational reconciliation" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't complete this occupancy reconciliation. Review the current records and try again.");
    expect(alert).not.toHaveTextContent("synthetic_unknown_occupancy_error");
  });

  it("Review later closes with zero mutation", async () => {
    const onClose = vi.fn();
    render(<ResolveOccupancyDrawer open propertyId="property-1" unitId="unit-1" onClose={onClose} />);
    fireEvent.click(await screen.findByRole("button", { name: "Review later" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(submit).not.toHaveBeenCalled();
  });

  it("moves focus through the named modal in both directions and contains repeated Tab", async () => {
    render(<DrawerHarness />);
    const opener = screen.getByRole("button", { name: "Resolve occupancy" });
    opener.focus();
    fireEvent.click(opener);

    const dialog = await screen.findByRole("dialog", { name: "Resolve Occupancy" });
    const close = screen.getByRole("button", { name: "Close Resolve Occupancy" });
    await waitFor(() => expect(close).toHaveFocus());

    fireEvent.keyDown(close, { key: "Tab" });
    expect(screen.getByLabelText("Record operational move-out")).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Tab" });
    expect(screen.getByLabelText("Correct stale occupancy records")).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Review later" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "Review later" })).toHaveFocus();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it("Escape closes without mutation and restores focus to the opener", async () => {
    render(<DrawerHarness />);
    const opener = screen.getByRole("button", { name: "Resolve occupancy" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog", { name: "Resolve Occupancy" });

    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
    expect(submit).not.toHaveBeenCalled();
  });

  it.each(["Close Resolve Occupancy", "Review later"])(
    "%s dismisses the controlled drawer and restores focus to the opener",
    async (buttonName) => {
      render(<DrawerHarness />);
      const opener = screen.getByRole("button", { name: "Resolve occupancy" });
      opener.focus();
      fireEvent.click(opener);
      fireEvent.click(await screen.findByRole("button", { name: buttonName }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() => expect(opener).toHaveFocus());
      expect(submit).not.toHaveBeenCalled();
    }
  );

  it("focuses a stable workspace fallback after success removes the opener", async () => {
    render(<DrawerHarness removeTriggerOnResolve />);
    const opener = screen.getByRole("button", { name: "Resolve occupancy" });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(await screen.findByLabelText("Correct stale occupancy records"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm operational reconciliation" }));

    const workspace = screen.getByRole("main", { name: "Occupancy workspace" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(workspace).toHaveFocus());
    expect(screen.queryByRole("button", { name: "Resolve occupancy" })).not.toBeInTheDocument();
  });
});
