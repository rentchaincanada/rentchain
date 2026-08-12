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
