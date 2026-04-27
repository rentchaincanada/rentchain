import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  beforeEach(() => {
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

  it("prefers tenant and property/unit labels over raw ids", async () => {
    render(
      <MemoryRouter>
        <MessagesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText("Taylor Tenant • Harbour View / Unit 2A").length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/Tenant tenant-/i)).not.toBeInTheDocument();
  });
});
