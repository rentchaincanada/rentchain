import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnitEditModal } from "./UnitEditModal";

const mocks = vi.hoisted(() => ({
  updateUnit: vi.fn(),
  uploadUnitLeaseDocument: vi.fn(),
}));

vi.mock("../../api/unitsApi", () => ({
  updateUnit: mocks.updateUnit,
  uploadUnitLeaseDocument: mocks.uploadUnitLeaseDocument,
}));

describe("UnitEditModal", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mocks.updateUnit.mockReset();
    mocks.uploadUnitLeaseDocument.mockReset();
    document.body.style.overflow = "";
    document.body.style.overscrollBehavior = "";
  });

  it("locks background scrolling and restores prior body styles when closed", () => {
    document.body.style.overflow = "scroll";
    document.body.style.overscrollBehavior = "auto";
    const { rerender } = render(
      <UnitEditModal
        open
        unit={{ id: "unit-1", unitNumber: "101", status: "vacant" }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.overscrollBehavior).toBe("none");
    expect(screen.getByRole("dialog", { name: "Edit unit" })).toBeInTheDocument();
    expect(document.querySelector(".rc-unit-edit-body")).toBeInTheDocument();
    expect(document.querySelector(".rc-unit-edit-actions")).toContainElement(
      screen.getByRole("button", { name: "Save" })
    );

    rerender(
      <UnitEditModal
        open={false}
        unit={{ id: "unit-1", unitNumber: "101", status: "vacant" }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(document.body.style.overflow).toBe("scroll");
    expect(document.body.style.overscrollBehavior).toBe("auto");
  });

  it("keeps Cancel independently clickable without saving", () => {
    const onClose = vi.fn();
    render(
      <UnitEditModal
        open
        unit={{ id: "unit-1", unitNumber: "101", status: "occupied" }}
        onClose={onClose}
        onSaved={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mocks.updateUnit).not.toHaveBeenCalled();
  });

  it("blocks placeholder unit IDs before submitting occupancy updates", async () => {
    render(
      <UnitEditModal
        open
        unit={{ id: "placeholder-0", unitNumber: "1", status: "vacant" }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "occupied" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/not ready for occupancy updates/i)).toBeInTheDocument();
    expect(mocks.updateUnit).not.toHaveBeenCalled();
  });

  it("submits persisted unit IDs with occupancy details", async () => {
    const onSaved = vi.fn();
    mocks.updateUnit.mockResolvedValue({
      unit: {
        id: "unit-1",
        status: "occupied",
        occupantName: "Jane Tenant",
        leaseEndDate: "2027-06-10",
      },
    });

    render(
      <UnitEditModal
        open
        unit={{ id: "unit-1", unitNumber: "101", status: "vacant" }}
        onClose={vi.fn()}
        onSaved={onSaved}
      />
    );

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "occupied" },
    });
    fireEvent.change(await screen.findByLabelText("Current tenant name"), {
      target: { value: "Jane Tenant" },
    });
    fireEvent.change(screen.getByLabelText("Lease end date (optional)"), {
      target: { value: "2027-06-10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mocks.updateUnit).toHaveBeenCalledWith(
        "unit-1",
        expect.objectContaining({
          status: "occupied",
          occupantName: "Jane Tenant",
          leaseEndDate: "2027-06-10",
        })
      );
    });
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "unit-1",
        status: "occupied",
        occupantName: "Jane Tenant",
        leaseEndDate: "2027-06-10",
      })
    );
  });

  it("submits canonical current occupancy for backend authority and shows End Lease guidance", async () => {
    mocks.updateUnit.mockRejectedValue(new Error("end_lease_workflow_required"));
    render(
      <UnitEditModal open unit={{ id: "unit-1", unitNumber: "101", status: "occupied" }} occupancyAuthority="current" onClose={vi.fn()} onSaved={vi.fn()} />
    );
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "vacant" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("End the lease before marking this unit vacant.")).toBeInTheDocument();
    expect(mocks.updateUnit).toHaveBeenCalledWith(
      "unit-1",
      expect.objectContaining({ status: "vacant" })
    );
    expect(screen.getByRole("dialog", { name: "Edit unit" })).toBeInTheDocument();
  });

  it("lets backend reconciliation override incomplete current occupancy context", async () => {
    mocks.updateUnit.mockRejectedValue(new Error("occupancy_reconciliation_required"));
    render(
      <UnitEditModal open unit={{ id: "unit-1", unitNumber: "101", status: "occupied" }} occupancyAuthority="current" onClose={vi.fn()} onSaved={vi.fn()} />
    );
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "vacant" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Resolve the occupancy records before changing this unit to vacant.")).toBeInTheDocument();
    expect(screen.queryByText("End the lease before marking this unit vacant.")).not.toBeInTheDocument();
    expect(mocks.updateUnit).toHaveBeenCalledWith(
      "unit-1",
      expect.objectContaining({ status: "vacant" })
    );
    expect(screen.getByRole("dialog", { name: "Edit unit" })).toBeInTheDocument();
  });

  it("blocks review-needed occupancy from being marked vacant and shows Resolve Occupancy guidance", async () => {
    render(
      <UnitEditModal open unit={{ id: "unit-1", unitNumber: "101", status: "occupied" }} occupancyAuthority="review" onClose={vi.fn()} onSaved={vi.fn()} />
    );
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "vacant" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Resolve the occupancy records before changing this unit to vacant.")).toBeInTheDocument();
    expect(mocks.updateUnit).not.toHaveBeenCalled();
  });

  it.each([
    ["end_lease_workflow_required", "End the lease before marking this unit vacant."],
    ["occupancy_reconciliation_required", "Resolve the occupancy records before changing this unit to vacant."],
  ])("maps backend %s conflicts to bounded guidance without closing", async (code, copy) => {
    const onClose = vi.fn();
    mocks.updateUnit.mockRejectedValue(new Error(code));
    render(<UnitEditModal open unit={{ id: "unit-1", unitNumber: "101", status: "vacant" }} onClose={onClose} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Monthly rent"), { target: { value: "1900" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(copy)).toBeInTheDocument();
    expect(screen.queryByText(code)).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps safe metadata edits available for current occupancy", async () => {
    mocks.updateUnit.mockResolvedValue({ unit: { id: "unit-1", unitNumber: "101A", status: "occupied" } });
    render(<UnitEditModal open unit={{ id: "unit-1", unitNumber: "101", status: "occupied" }} occupancyAuthority="current" onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Unit number"), { target: { value: "101A" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.updateUnit).toHaveBeenCalled());
  });

  it("keeps the modal open when the update response omits a persisted ID", async () => {
    const onClose = vi.fn();
    const onSaved = vi.fn();
    mocks.updateUnit.mockResolvedValue({
      unit: {
        status: "occupied",
        occupantName: "Jane Tenant",
      },
    });

    render(
      <UnitEditModal
        open
        unit={{ id: "unit-1", unitNumber: "101", status: "vacant" }}
        onClose={onClose}
        onSaved={onSaved}
      />
    );

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "occupied" },
    });
    fireEvent.change(await screen.findByLabelText("Current tenant name"), {
      target: { value: "Jane Tenant" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/stable ID was not returned/i)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
