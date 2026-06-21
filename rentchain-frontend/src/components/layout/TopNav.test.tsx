import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TopNav from "./TopNav";

const mocks = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  logoutMock: vi.fn(),
  useAuthMock: vi.fn(),
  useCapabilitiesMock: vi.fn(),
  fetchLandlordConversationsMock: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigateMock,
  };
});

vi.mock("../../context/useAuth", () => ({
  useAuth: mocks.useAuthMock,
}));

vi.mock("@/hooks/useCapabilities", () => ({
  useCapabilities: mocks.useCapabilitiesMock,
}));

vi.mock("../../api/messagesApi", () => ({
  fetchLandlordConversations: mocks.fetchLandlordConversationsMock,
}));

vi.mock("./WorkspaceDrawer", () => ({
  WorkspaceDrawer: () => null,
}));

vi.mock("../brand/RentChainLogo", () => ({
  RentChainLogo: () => <div>RentChain</div>,
}));

describe("TopNav", () => {
  beforeEach(() => {
    mocks.navigateMock.mockReset();
    mocks.logoutMock.mockReset();
    mocks.fetchLandlordConversationsMock.mockResolvedValue([]);
    mocks.useAuthMock.mockReturnValue({
      user: { id: "landlord-1", role: "landlord", actorRole: "landlord", email: "l@example.com" },
      logout: mocks.logoutMock,
      ready: true,
      isLoading: false,
      authStatus: "authed",
    });
    mocks.useCapabilitiesMock.mockReturnValue({
      features: { messaging: true },
      loading: false,
    });
  });

  it("renders a landlord inbox shortcut and routes to the unified inbox", async () => {
    render(<TopNav />);

    const messagesButton = await screen.findByRole("button", { name: "Inbox" });
    fireEvent.click(messagesButton);

    expect(mocks.navigateMock).toHaveBeenCalledWith("/landlord/inbox");
  });

  it("shows unread indicator from existing conversation unread data", async () => {
    mocks.fetchLandlordConversationsMock.mockResolvedValue([{ id: "conv-1", hasUnread: true }]);

    render(<TopNav />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Inbox (unread)" })).toBeInTheDocument();
    });
  });
});
