import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
        tenantDisplayName: "Taylor Tenant",
        propertyDisplayLabel: "Harbour View",
        unitDisplayLabel: "Unit 2A",
      },
    ]);
    mocks.fetchLandlordConversationMessagesMock.mockResolvedValue({
      conversation: {
        id: "conv-1",
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
    expect(screen.getByText("Taylor Tenant")).toBeInTheDocument();
    expect(screen.getByText("Harbour View / Unit 2A")).toBeInTheDocument();
    expect(screen.getByText("TT")).toBeInTheDocument();
    expect(screen.queryByText(/Tenant tenant-/i)).not.toBeInTheDocument();
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

  it("uses safe context fallbacks and deterministic initials for Taylor Tenant", async () => {
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
    expect(screen.getAllByText("Taylor Tenant • Conversation").length).toBeGreaterThan(0);
    expect(screen.queryByText("Tenant conversation • Unit unavailable")).not.toBeInTheDocument();
    expect(screen.getAllByText("TT")[0]).toBeInTheDocument();
    expect(screen.queryByText(/tenant-raw-1/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/prop-raw-1/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/unit-raw-1/i)).not.toBeInTheDocument();
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
    expect(screen.getByText("Morgan Tenant • Property unavailable")).toBeInTheDocument();
    expect(screen.getByText("Tenant • North Point / Unit 8")).toBeInTheDocument();
    expect(screen.queryByText("Tenant conversation • Unit unavailable")).not.toBeInTheDocument();
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
