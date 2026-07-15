import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  WorkspaceDrawer: ({ open, userEmail, userRole }: { open: boolean; userEmail?: string; userRole?: string | null }) =>
    open ? (
      <div role="dialog" aria-label="Workspace navigation">
        <button type="button">Account</button>
        <span>{userRole}</span>
        <span>{userEmail}</span>
      </div>
    ) : null,
}));

vi.mock("../brand/RentChainLogo", () => ({
  RentChainLogo: () => <div>RentChain</div>,
}));

describe("TopNav", () => {
  afterEach(() => {
    cleanup();
  });

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

  it("replaces the prominent account text action with a scheduling shortcut", async () => {
    render(<TopNav />);

    const scheduleButton = await screen.findByRole("button", { name: /Scheduling/i });
    fireEvent.click(scheduleButton);

    expect(mocks.navigateMock).toHaveBeenCalledWith("/scheduling");
    expect(screen.queryByText("My Account")).not.toBeInTheDocument();
  });

  it("renders account access as verified-name initials and opens the workspace drawer", async () => {
    mocks.useAuthMock.mockReturnValue({
      user: {
        id: "landlord-1",
        role: "landlord",
        actorRole: "landlord",
        email: "paul@example.com",
        verifiedName: "Paul Chater",
      },
      logout: mocks.logoutMock,
      ready: true,
      isLoading: false,
      authStatus: "authed",
    });

    render(<TopNav />);

    const accountButton = await screen.findByRole("button", { name: "Account menu for Paul Chater" });
    expect(accountButton).toHaveTextContent("PC");

    fireEvent.click(accountButton);

    expect(screen.getByRole("dialog", { name: "Workspace navigation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account" })).toBeInTheDocument();
  });

  it("falls back to email-derived initials when a display name is unavailable", async () => {
    mocks.useAuthMock.mockReturnValue({
      user: {
        id: "landlord-1",
        role: "landlord",
        actorRole: "landlord",
        email: "property.manager@example.com",
      },
      logout: mocks.logoutMock,
      ready: true,
      isLoading: false,
      authStatus: "authed",
    });

    render(<TopNav />);

    expect(await screen.findByRole("button", { name: "Account menu" })).toHaveTextContent("PM");
    expect(screen.queryByText("My Account")).not.toBeInTheDocument();
  });

  it("shows unread indicator from existing conversation unread data", async () => {
    mocks.fetchLandlordConversationsMock.mockResolvedValue([{ id: "conv-1", hasUnread: true }]);

    render(<TopNav />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Inbox (unread)" })).toBeInTheDocument();
    });
  });
});
