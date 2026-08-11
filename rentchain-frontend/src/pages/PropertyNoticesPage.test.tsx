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
  { tenantId: "tenant-1", tenantDisplayName: "Alex Current", unitIds: ["unit-1", "unit-3"], unitLabels: ["1A", "3C"], propertyIds: ["property-1", "property-2"], propertyLabels: ["Harbour House", "Queen Court"], units: [{ id: "unit-1", label: "1A", propertyId: "property-1", propertyLabel: "Harbour House" }, { id: "unit-3", label: "3C", propertyId: "property-2", propertyLabel: "Queen Court" }], deliveryAvailability: "available" },
  { tenantId: "tenant-2", tenantDisplayName: "Blair Missing", unitIds: ["unit-2"], unitLabels: ["2B"], propertyIds: ["property-1"], propertyLabels: ["Harbour House"], units: [{ id: "unit-2", label: "2B", propertyId: "property-1", propertyLabel: "Harbour House" }], deliveryAvailability: "missing_email" },
];

describe("PropertyNoticesPage", () => {
  beforeEach(() => {
    mocks.fetchProperties.mockResolvedValue({ properties: [{ id: "property-1", name: "Harbour House", addressLine1: "1 Main", totalUnits: 2, createdAt: "now", units: [] }, { id: "property-2", name: "Queen Court", addressLine1: "2 Main", totalUnits: 1, createdAt: "now", units: [] }] });
    mocks.fetchNotices.mockResolvedValue([]);
    mocks.fetchRecipients.mockResolvedValue({ properties: [{ id: "property-1", label: "Harbour House" }, { id: "property-2", label: "Queen Court" }], propertyBreakdown: [{ id: "property-1", label: "Harbour House", recipientCount: 2 }, { id: "property-2", label: "Queen Court", recipientCount: 1 }], recipients, counts: { total: 2, available: 1, skipped: 1 }, maxRecipients: 100 });
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
    fireEvent.click(screen.getByLabelText("Harbour House"));
    fireEvent.click(screen.getByRole("button", { name: "Resolve current recipients" }));
    expect(await screen.findByText(/Alex Current/)).toBeInTheDocument();
    expect(screen.queryByText(/Former Tenant/)).not.toBeInTheDocument();
    expect(screen.getByText(/Blair Missing.*missing email/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Harbour House — 1A"));
    expect(screen.getByText(/Preview recipients \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/1 private deliveries.*0 skipped/)).toBeInTheDocument();
  });

  it("requires confirmation, makes one bounded send, and prevents double submit", async () => {
    let finish!: (value: unknown) => void;
    mocks.sendNotice.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<PropertyNoticesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "New Notice" }));
    fireEvent.click(screen.getByLabelText("Harbour House"));
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
    expect(mocks.sendNotice.mock.calls[0][0].propertyIds).toEqual(["property-1"]);
    finish({ created: true, notice: { id: "notice-1" } });
    await waitFor(() => expect(screen.getByText("No operational notices have been sent.")).toBeInTheDocument());
  });

  it("selects multiple properties, groups units by property, and confirms portfolio scope", async () => {
    render(<PropertyNoticesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "New Notice" }));
    fireEvent.click(screen.getByLabelText("Queen Court"));
    fireEvent.click(screen.getByLabelText("Harbour House"));
    expect(screen.getByText(/2 selected/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resolve current recipients" }));
    expect(await screen.findByText(/2 properties · 2 eligible occupants · 1 deliverable · 1 skipped/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Property recipient breakdown" })).toHaveTextContent("Harbour House — 2 recipients");
    expect(screen.getByLabelText("Harbour House — 1A")).toBeInTheDocument();
    expect(screen.getByLabelText("Queen Court — 3C")).toBeInTheDocument();
    expect(mocks.fetchRecipients).toHaveBeenCalledWith(["property-1", "property-2"]);
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Portfolio update" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Shared message." } });
    fireEvent.click(screen.getByRole("button", { name: "Preview Notice" }));
    expect(within(screen.getByRole("dialog", { name: "Confirm notice" })).getByText(/2 selected properties/)).toBeInTheDocument();
  });

  it("renders multi-property history and detail snapshots", async () => {
    mocks.fetchNotices.mockResolvedValue([{ id: "notice-1", subject: "Portfolio update", body: "Shared message.", status: "completed", propertyIds: ["property-1", "property-2"], properties: [{ id: "property-1", label: "Harbour House" }, { id: "property-2", label: "Queen Court" }], propertyCount: 2, recipientCount: 2, sentCount: 2, failedCount: 0, skippedCount: 0 }]);
    mocks.fetchNotice.mockResolvedValue({ notice: (await mocks.fetchNotices())[0], deliveries: [{ id: "delivery-1", tenantId: "tenant-1", tenantDisplayName: "Alex Current", unitIds: ["unit-1", "unit-3"], unitLabels: ["1A", "3C"], propertyIds: ["property-1", "property-2"], propertyLabels: ["Harbour House", "Queen Court"], units: recipients[0].units, channel: "email", status: "sent" }] });
    render(<PropertyNoticesPage />);
    expect(await screen.findByText(/2 properties/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Portfolio update"));
    expect(await screen.findByRole("list", { name: "Selected properties" })).toHaveTextContent("Harbour House");
    expect(screen.getByText(/Alex Current.*Harbour House — 1A.*Queen Court — 3C.*sent/)).toBeInTheDocument();
  });

  it("explains how to reduce scope when the aggregate recipient cap is exceeded", async () => {
    const sendsBefore = mocks.sendNotice.mock.calls.length;
    mocks.fetchRecipients.mockRejectedValue(Object.assign(new Error("cap"), { status: 422 }));
    render(<PropertyNoticesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "New Notice" }));
    fireEvent.click(screen.getByLabelText("Harbour House"));
    fireEvent.click(screen.getByRole("button", { name: "Resolve current recipients" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Recipient limit exceeded. Reduce selected properties or filter units and tenants.");
    expect(mocks.sendNotice).toHaveBeenCalledTimes(sendsBefore);
  });
});
