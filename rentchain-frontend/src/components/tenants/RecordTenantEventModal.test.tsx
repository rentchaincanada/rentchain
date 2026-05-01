import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecordTenantEventModal } from "./RecordTenantEventModal";

const mocks = vi.hoisted(() => ({
  createTenantEvent: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("../../api/tenantEventsWriteApi", () => ({
  createTenantEvent: mocks.createTenantEvent,
}));

vi.mock("../ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

describe("RecordTenantEventModal", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("explains that tenant activity records timeline notes only", () => {
    render(
      <RecordTenantEventModal
        open
        tenantId="tenant-1"
        tenantName="Taylor Tenant"
        onClose={vi.fn()}
      />
    );

    expect(
      screen.getByText(
        /Tenant activity records notes on the tenant timeline only\. To add charges or payments to the lease ledger, use the current lease ledger\./
      )
    ).toBeInTheDocument();
  });

  it("labels finance-looking activity types as timeline notes", () => {
    render(
      <RecordTenantEventModal
        open
        tenantId="tenant-1"
        tenantName="Taylor Tenant"
        onClose={vi.fn()}
      />
    );

    expect(
      screen.getByText("Timeline note only — does not update the lease ledger or payments register.")
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Event type/i), { target: { value: "CHARGE_ADDED" } });

    expect(
      screen.getByText("Timeline note only — does not update the lease ledger or payments register.")
    ).toBeInTheDocument();
  });
});
