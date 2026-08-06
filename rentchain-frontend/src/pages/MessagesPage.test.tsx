import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import MessagesPage from "./MessagesPage";

const mocks = vi.hoisted(() => ({
  fetchLandlordConversationsMock: vi.fn(),
  fetchLandlordConversationMessagesMock: vi.fn(),
  markLandlordConversationReadMock: vi.fn(),
  sendLandlordMessageMock: vi.fn(),
  useCapabilitiesMock: vi.fn(),
  openUpgradeMock: vi.fn(),
}));

vi.mock("@/api/messagesApi", () => ({
  fetchLandlordConversations: mocks.fetchLandlordConversationsMock,
  fetchLandlordConversationMessages: mocks.fetchLandlordConversationMessagesMock,
  markLandlordConversationRead: mocks.markLandlordConversationReadMock,
  sendLandlordMessage: mocks.sendLandlordMessageMock,
}));

vi.mock("@/hooks/useCapabilities", () => ({
  useCapabilities: mocks.useCapabilitiesMock,
}));

vi.mock("@/context/UpgradeContext", () => ({
  useUpgrade: () => ({ openUpgrade: mocks.openUpgradeMock }),
}));

vi.mock("@/components/billing/LockedFeature", () => ({
  LockedFeature: ({ featureKey }: { featureKey: string }) => <div>Locked feature: {featureKey}</div>,
}));

vi.mock("@/components/layout/ResponsiveMasterDetail", () => ({
  ResponsiveMasterDetail: ({ masterTitle, selectedLabel, masterDropdown, master, detail }: any) => (
    <div>
      <div>{masterTitle}</div>
      <div>{selectedLabel}</div>
      {masterDropdown}
      {master}
      {detail}
    </div>
  ),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

describe("MessagesPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    mocks.fetchLandlordConversationsMock.mockReset();
    mocks.fetchLandlordConversationMessagesMock.mockReset();
    mocks.markLandlordConversationReadMock.mockReset();
    mocks.sendLandlordMessageMock.mockReset();
    mocks.useCapabilitiesMock.mockReturnValue({
      features: { messaging: true },
      loading: false,
    });
    mocks.fetchLandlordConversationsMock.mockResolvedValue([
      {
        id: "conv-1",
        tenantId: "tenant-1",
        tenantDisplayName: "Taylor Tenant",
        propertyDisplayLabel: "Harbour View",
        unitDisplayLabel: "Unit 2A",
      },
    ]);
    mocks.fetchLandlordConversationMessagesMock.mockResolvedValue({
      conversation: {
        id: "conv-1",
        tenantId: "tenant-1",
        tenantDisplayName: "Taylor Tenant",
        propertyDisplayLabel: "Harbour View",
        unitDisplayLabel: "Unit 2A",
      },
      messages: [],
    });
    mocks.markLandlordConversationReadMock.mockResolvedValue(undefined);
    mocks.sendLandlordMessageMock.mockResolvedValue(undefined);
  });

  async function flushTimers(ms: number) {
    await act(async () => {
      vi.advanceTimersByTime(ms);
      await Promise.resolve();
    });
  }

  async function flushAsync() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("prefers tenant and property/unit labels over raw ids", async () => {
    render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>
    );

    await flushAsync();
    expect(screen.getAllByText("Taylor Tenant").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Harbour View / Unit 2A").length).toBeGreaterThan(0);
    expect(screen.getByText("TT")).toBeInTheDocument();
    expect(screen.queryByText(/Tenant tenant-/i)).not.toBeInTheDocument();
  });

  it("shows a locked messages state without loading conversations when messaging is unavailable", async () => {
    mocks.useCapabilitiesMock.mockReturnValue({
      features: { messaging: false },
      loading: false,
    });

    render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Locked feature: messaging")).toBeInTheDocument();
    expect(mocks.fetchLandlordConversationsMock).not.toHaveBeenCalled();
  });

  it("marks an unread selected conversation read without exposing raw ids", async () => {
    mocks.fetchLandlordConversationsMock.mockResolvedValue([
      {
        id: "conv-1",
        tenantDisplayName: "Taylor Tenant",
        propertyDisplayLabel: "Harbour View",
        unitDisplayLabel: "Unit 2A",
        hasUnread: true,
      },
    ]);

    const { container } = render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>
    );

    await flushAsync();
    expect(container.querySelector(".rc-messages-list-item-title")?.textContent).toContain("Taylor Tenant");
    expect(mocks.markLandlordConversationReadMock).toHaveBeenCalledTimes(1);
  });

  it("uses conservative context fallbacks and deterministic initials for Taylor Tenant", async () => {
    mocks.fetchLandlordConversationsMock.mockResolvedValue([
      {
        id: "conv-2",
        tenantDisplayName: "Taylor Tenant",
        tenantId: "tenant-raw-1",
        propertyId: "prop-raw-1",
        unitId: "unit-raw-1",
      },
    ]);
    mocks.fetchLandlordConversationMessagesMock.mockResolvedValue({
      conversation: {
        id: "conv-2",
        tenantDisplayName: "Taylor Tenant",
        tenantId: "tenant-raw-1",
        propertyId: "prop-raw-1",
        unitId: "unit-raw-1",
      },
      messages: [],
    });

    render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>
    );

    await flushAsync();
    expect(screen.getAllByText("Taylor Tenant")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Taylor Tenant • Linked property / linked unit").length).toBeGreaterThan(0);
    expect(screen.queryByText(/prop-raw-1|unit-raw-1/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Tenant conversation • Unit unavailable")).not.toBeInTheDocument();
    expect(screen.getAllByText("TT")[0]).toBeInTheDocument();
    expect(screen.queryByText(/unavailable/i)).not.toBeInTheDocument();
  });

  it("keeps message labels useful when property or unit context is incomplete", async () => {
    mocks.fetchLandlordConversationsMock.mockResolvedValue([
      {
        id: "conv-2",
        tenantDisplayName: "Jordan Tenant",
        unitDisplayLabel: "4B",
      },
      {
        id: "conv-3",
        tenantDisplayName: "Morgan Tenant",
        propertyDisplayLabel: "Harbour View",
      },
      {
        id: "conv-4",
        propertyDisplayLabel: "North Point",
        unitDisplayLabel: "Unit 8",
      },
    ]);
    mocks.fetchLandlordConversationMessagesMock.mockResolvedValue({
      conversation: {
        id: "conv-2",
        tenantDisplayName: "Jordan Tenant",
        unitDisplayLabel: "4B",
      },
      messages: [],
    });

    render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>
    );

    await flushAsync();
    expect(screen.getAllByText("Jordan Tenant • Unit 4B").length).toBeGreaterThan(0);
    expect(screen.getByText("Morgan Tenant • Harbour View")).toBeInTheDocument();
    expect(screen.getByText("Tenant • North Point / Unit 8")).toBeInTheDocument();
    expect(screen.queryByText("Tenant conversation • Unit unavailable")).not.toBeInTheDocument();
    expect(screen.queryByText(/unavailable/i)).not.toBeInTheDocument();
  });

  it("uses conservative labels instead of raw ids when only ids are present", async () => {
    mocks.fetchLandlordConversationsMock.mockResolvedValue([
      {
        id: "conv-5",
        tenantId: "tenant-raw-5",
        propertyId: "prop-raw-5",
        unitId: "unit-raw-5",
      },
    ]);
    mocks.fetchLandlordConversationMessagesMock.mockResolvedValue({
      conversation: {
        id: "conv-5",
        tenantId: "tenant-raw-5",
        propertyId: "prop-raw-5",
        unitId: "unit-raw-5",
      },
      messages: [],
    });

    render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>
    );

    await flushAsync();
    expect(screen.getAllByText("Tenant • Linked property / linked unit").length).toBeGreaterThan(0);
    expect(screen.queryByText(/tenant-raw-5|prop-raw-5|unit-raw-5/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/unavailable/i)).not.toBeInTheDocument();
  });

  it("renders profile buttons that navigate to the tenant profile when tenantId is present", async () => {
    render(
      <MemoryRouter>
        <LocationProbe />
        <MessagesPage />
      </MemoryRouter>
    );

    await flushAsync();
    expect(screen.queryByRole("link", { name: "Taylor Tenant" })).not.toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Profile" });
    expect(buttons.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(buttons[0]);
    expect(screen.getByTestId("location")).toHaveTextContent("/tenants?tenantId=tenant-1");
  });

  it("keeps landlord message tenant names as plain text when tenantId is missing", async () => {
    mocks.fetchLandlordConversationsMock.mockResolvedValue([
      {
        id: "conv-missing-tenant",
        tenantDisplayName: "Taylor Tenant",
        propertyDisplayLabel: "Harbour View",
        unitDisplayLabel: "Unit 2A",
      },
    ]);
    mocks.fetchLandlordConversationMessagesMock.mockResolvedValue({
      conversation: {
        id: "conv-missing-tenant",
        tenantDisplayName: "Taylor Tenant",
        propertyDisplayLabel: "Harbour View",
        unitDisplayLabel: "Unit 2A",
      },
      messages: [],
    });

    render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>
    );

    await flushAsync();
    expect(screen.getAllByText("Taylor Tenant").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Taylor Tenant" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Profile" })).not.toBeInTheDocument();
  });

  it("keeps profile buttons from reselecting the message thread", async () => {
    render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>
    );

    await flushAsync();
    fireEvent.click(screen.getAllByRole("button", { name: "Profile" })[0]);

    expect(mocks.fetchLandlordConversationMessagesMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the rest of a conversation row selectable when the profile button is present", async () => {
    mocks.fetchLandlordConversationsMock.mockResolvedValue([
      {
        id: "conv-1",
        tenantId: "tenant-1",
        tenantDisplayName: "Taylor Tenant",
        propertyDisplayLabel: "Harbour View",
        unitDisplayLabel: "Unit 2A",
      },
      {
        id: "conv-2",
        tenantId: "tenant-2",
        tenantDisplayName: "Jordan Tenant",
        propertyDisplayLabel: "North Point",
        unitDisplayLabel: "Unit 3",
      },
    ]);
    mocks.fetchLandlordConversationMessagesMock.mockImplementation(async (id: string) => ({
      conversation: {
        id,
        tenantId: id === "conv-2" ? "tenant-2" : "tenant-1",
        tenantDisplayName: id === "conv-2" ? "Jordan Tenant" : "Taylor Tenant",
        propertyDisplayLabel: id === "conv-2" ? "North Point" : "Harbour View",
        unitDisplayLabel: id === "conv-2" ? "Unit 3" : "Unit 2A",
      },
      messages: [],
    }));

    render(
      <MemoryRouter>
        <LocationProbe />
        <MessagesPage />
      </MemoryRouter>
    );

    await flushAsync();
    fireEvent.click(screen.getByText("North Point / Unit 3"));

    expect(screen.getByTestId("location")).toHaveTextContent("/messages?threadId=conv-2");
    expect(mocks.fetchLandlordConversationMessagesMock).toHaveBeenCalledWith("conv-2");
  });

  it("preserves the selected conversation across background refresh without blanking the thread", async () => {
    mocks.fetchLandlordConversationMessagesMock.mockResolvedValue({
      conversation: {
        id: "conv-1",
        tenantDisplayName: "Taylor Tenant",
        propertyDisplayLabel: "Harbour View",
        unitDisplayLabel: "Unit 2A",
      },
      messages: [
        {
          id: "msg-1",
          conversationId: "conv-1",
          senderRole: "tenant",
          body: "Hello there",
          createdAtMs: 1,
        },
      ],
    });

    render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>
    );

    await flushAsync();
    expect(screen.getByText("Hello there")).toBeInTheDocument();
    expect(screen.getAllByText("Taylor Tenant • Harbour View / Unit 2A").length).toBeGreaterThan(0);

    await flushTimers(15000);
    await flushTimers(12000);

    expect(screen.getByText("Hello there")).toBeInTheDocument();
    expect(screen.queryByText("Loading messages…")).not.toBeInTheDocument();
    expect(screen.getAllByText("Taylor Tenant • Harbour View / Unit 2A").length).toBeGreaterThan(0);
  });

  it("exposes distinct bounded scroll regions while keeping the composer in the detail panel", async () => {
    const { container } = render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>
    );

    await flushAsync();

    const list = screen.getByTestId("messages-conversation-scroll");
    const detailPanel = screen.getByTestId("messages-detail-panel");
    const detailScroll = screen.getByTestId("messages-detail-scroll");
    const composer = screen.getByTestId("messages-composer");

    expect(list).toHaveClass("rc-messages-list");
    expect(detailPanel).toContainElement(detailScroll);
    expect(detailPanel).toContainElement(composer);
    expect(container.querySelector(".rc-messages-list-item")).toBeInTheDocument();
  });

  it("keeps long tenant and property labels in the selectable conversation card structure", async () => {
    mocks.fetchLandlordConversationsMock.mockResolvedValue([
      {
        id: "conv-long",
        tenantId: "tenant-long",
        tenantDisplayName: "QA Tenant With An Intentionally Extremely Long Display Name That Must Stay Inside The Conversation Card",
        propertyDisplayLabel: "QA Harbour Property With A Deliberately Long Responsive Layout Verification Label",
        unitDisplayLabel: "Unit 9999 With Extended Context",
        hasUnread: false,
      },
      {
        id: "conv-short",
        tenantId: "tenant-short",
        tenantDisplayName: "Short Tenant",
        propertyDisplayLabel: "Harbour View",
        unitDisplayLabel: "2A",
        hasUnread: true,
      },
    ]);

    render(
      <MemoryRouter>
        <MessagesPage />
        <LocationProbe />
      </MemoryRouter>
    );
    await flushAsync();

    const title = screen
      .getByTestId("messages-conversation-scroll")
      .querySelector(".rc-messages-list-item-title") as HTMLElement;
    expect(title).toHaveTextContent(/QA Tenant With An Intentionally Extremely Long Display Name/);
    const card = title.closest(".rc-messages-list-item");
    expect(card).toContainElement(title.closest(".rc-messages-list-item-title"));
    const meta = card?.querySelector(".rc-messages-list-item-meta") as HTMLElement;
    expect(meta).toHaveTextContent(/QA Harbour Property With A Deliberately Long/);
    expect(card).toContainElement(meta);
    expect(card?.getAttribute("style")).toContain("background");

    const shortCard = screen.getByText("Short Tenant").closest(".rc-messages-list-item");
    expect(shortCard?.querySelector(".rc-messages-unread-dot")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Short Tenant"));
    expect(screen.getByTestId("location")).toHaveTextContent("/messages?threadId=conv-short");
  });

  it("retains the local width and independent-scroll CSS contracts", () => {
    const css = readFileSync(resolve(process.cwd(), "src/pages/MessagesPage.css"), "utf8");

    expect(css).toMatch(/\.rc-messages-list-item\s*\{[\s\S]*?box-sizing:\s*border-box;/);
    expect(css).toMatch(/\.rc-messages-list-item\s*\{[\s\S]*?max-width:\s*100%;/);
    expect(css).toMatch(/\.rc-messages-list-item\s*\{[\s\S]*?flex:\s*0 0 auto;/);
    expect(css).toMatch(/\.rc-messages-list-item\s*\{[\s\S]*?height:\s*auto;/);
    expect(css).toMatch(/\.rc-messages-list-item-body\s*\{[\s\S]*?align-items:\s*flex-start;/);
    expect(css).toMatch(/\.rc-messages-list-item-title\s*\{[\s\S]*?flex:\s*1 1 auto;/);
    expect(css).toMatch(/\.rc-messages-unread-dot\s*\{[\s\S]*?flex:\s*0 0 auto;/);
    expect(css).toMatch(/\.rc-messages-list\s*\{[\s\S]*?overflow-x:\s*hidden;[\s\S]*?overflow-y:\s*auto;/);
    expect(css).toMatch(/\.rc-messages-thread\s*\{[\s\S]*?height:\s*100%;[\s\S]*?overflow:\s*hidden;/);
    expect(css).toMatch(/\.rc-messages-thread-body\s*\{[\s\S]*?overflow-y:\s*auto;/);
    expect(css).toMatch(/\.rc-messages-composer-input\s*\{[\s\S]*?min-width:\s*0;/);
  });

  it("keeps the composer usable and sends through the selected conversation", async () => {
    render(
      <MemoryRouter initialEntries={["/messages?threadId=conv-1"]}>
        <MessagesPage />
      </MemoryRouter>
    );

    await flushAsync();
    const composer = screen.getByPlaceholderText("Write a message");
    composer.focus();
    fireEvent.change(composer, { target: { value: "Synthetic composer check" } });
    expect(composer).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await flushAsync();

    expect(mocks.sendLandlordMessageMock).toHaveBeenCalledWith(
      "conv-1",
      "Synthetic composer check"
    );
  });

  it("does not repeatedly fire read for a stable selected conversation after background refresh", async () => {
    mocks.fetchLandlordConversationsMock.mockResolvedValue([
      {
        id: "conv-1",
        tenantDisplayName: "Taylor Tenant",
        propertyDisplayLabel: "Harbour View",
        unitDisplayLabel: "Unit 2A",
        hasUnread: true,
        lastMessageAt: 123,
      },
    ]);
    mocks.fetchLandlordConversationMessagesMock.mockResolvedValue({
      conversation: {
        id: "conv-1",
        tenantDisplayName: "Taylor Tenant",
        propertyDisplayLabel: "Harbour View",
        unitDisplayLabel: "Unit 2A",
        hasUnread: true,
        lastMessageAt: 123,
      },
      messages: [],
    });

    render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>
    );

    await flushAsync();
    expect(mocks.markLandlordConversationReadMock).toHaveBeenCalledTimes(1);

    await flushTimers(15000);
    await flushTimers(12000);

    expect(mocks.markLandlordConversationReadMock).toHaveBeenCalledTimes(1);
  });
});
