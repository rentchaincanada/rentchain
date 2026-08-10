import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PropertyNoticesPage from "./PropertyNoticesPage";

const mocks = vi.hoisted(() => ({
  fetchProperties: vi.fn(), fetchRecipients: vi.fn(), fetchNotices: vi.fn(), fetchNotice: vi.fn(), sendNotice: vi.fn(),
}));

vi.mock("@/api/propertiesApi", () => ({ fetchProperties: mocks.fetchProperties }));
vi.mock("@/api/propertyNoticesApi", () => ({
  fetchNoticeRecipients: mocks.fetchRecipients,
  fetchPropertyNotices: mocks.fetchNotices,
  fetchPropertyNotice: mocks.fetchNotice,
  sendPropertyNotice: mocks.sendNotice,
}));

const recipients = [
  { tenantId: "tenant-1", tenantDisplayName: "Alex Current", unitIds: ["unit-1"], unitLabels: ["1A"], deliveryAvailability: "available" },
  { tenantId: "tenant-2", tenantDisplayName: "Blair Missing", unitIds: ["unit-2"], unitLabels: ["2B"], deliveryAvailability: "missing_email" },
];

describe("PropertyNoticesPage", () => {
  beforeEach(() => {
    mocks.fetchProperties.mockResolvedValue({ properties: [{ id: "property-1", name: "Harbour House", addressLine1: "1 Main", totalUnits: 2, createdAt: "now", units: [] }] });
    mocks.fetchNotices.mockResolvedValue([]);
    mocks.fetchRecipients.mockResolvedValue({ property: { id: "property-1", label: "Harbour House" }, recipients, counts: { total: 2, available: 1, skipped: 1 }, maxRecipients: 100 });
    mocks.sendNotice.mockResolvedValue({ created: true, notice: { id: "notice-1", status: "completed" } });
  });
  afterEach(() => cleanup());

  it("shows the history empty state and formal-notice boundary", async () => {
    render(<PropertyNoticesPage />);
    expect(await screen.findByText("No operational notices have been sent.")).toBeInTheDocument();
    expect(screen.getByText(/Formal tenancy notices follow a separate process/)).toBeInTheDocument();
  });

  it("resolves current recipients, supports unit filters, and previews skipped recipients", async () => {
    render(<PropertyNoticesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "New Notice" }));
    fireEvent.change(screen.getByLabelText("Property"), { target: { value: "property-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Resolve current recipients" }));
    expect(await screen.findByText(/Alex Current/)).toBeInTheDocument();
    expect(screen.queryByText(/Former Tenant/)).not.toBeInTheDocument();
    expect(screen.getByText(/Blair Missing.*missing email/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("1A"));
    expect(screen.getByText(/Preview recipients \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/1 private deliveries.*0 skipped/)).toBeInTheDocument();
  });

  it("requires confirmation, makes one bounded send, and prevents double submit", async () => {
    let finish!: (value: any) => void;
    mocks.sendNotice.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<PropertyNoticesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "New Notice" }));
    fireEvent.change(screen.getByLabelText("Property"), { target: { value: "property-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Resolve current recipients" }));
    await screen.findByText(/Alex Current/);
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Water shutdown" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Water is off at noon." } });
    fireEvent.click(screen.getByRole("button", { name: "Preview Notice" }));
    const dialog = screen.getByRole("dialog", { name: "Confirm notice" });
    expect(within(dialog).getByText(/Each recipient receives a separate private delivery/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Send Notice" }));
    expect(within(dialog).getByRole("button", { name: "Sending…" })).toBeDisabled();
    expect(mocks.sendNotice).toHaveBeenCalledTimes(1);
    expect(mocks.sendNotice.mock.calls[0][0]).not.toHaveProperty("recipientEmails");
    finish({ created: true, notice: { id: "notice-1" } });
    await waitFor(() => expect(screen.getByText("No operational notices have been sent.")).toBeInTheDocument());
  });
});
