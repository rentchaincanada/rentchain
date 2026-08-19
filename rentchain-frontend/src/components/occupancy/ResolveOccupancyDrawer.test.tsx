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

  it("keeps the workflow open and refreshes context after a stale-state response", async () => {
    submit.mockRejectedValue(Object.assign(new Error("stale"), { body: { error: "occupancy_state_stale", freshContext: { ...context, expectedStateToken: "token-2" } } }));
    render(<ResolveOccupancyDrawer open propertyId="property-1" unitId="unit-1" tenantId="tenant-1" onClose={vi.fn()} />);
    fireEvent.click(await screen.findByLabelText("Correct stale occupancy records"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm operational reconciliation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/changed while this review was open/i);
    expect(screen.getByRole("dialog", { name: "Resolve Occupancy" })).toBeInTheDocument();
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
