import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TopNav from "./TopNav";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  logoutMock: vi.fn(),
  useAuthMock: vi.fn(),
  useCapabilitiesMock: vi.fn(),
  fetchLandlordConversationsMock: vi.fn(),
  fetchUnifiedInboxMock: vi.fn(),
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

vi.mock("../../api/unifiedInboxApi", () => ({
  fetchUnifiedInbox: mocks.fetchUnifiedInboxMock,
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
  function renderTopNav(path = "/dashboard") {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <TopNav />
      </MemoryRouter>
    );
  }

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mocks.navigateMock.mockReset();
    mocks.logoutMock.mockReset();
    mocks.fetchLandlordConversationsMock.mockReset();
    mocks.fetchUnifiedInboxMock.mockReset();
    mocks.fetchLandlordConversationsMock.mockResolvedValue([]);
    mocks.fetchUnifiedInboxMock.mockResolvedValue({ items: [], records: [] });
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

  it("replaces the Inbox shortcut with an accessible Communications menu", async () => {
    renderTopNav("/messages");

    expect(screen.queryByRole("button", { name: /^Inbox/ })).not.toBeInTheDocument();
    const communicationsButton = await screen.findByRole("button", { name: "Communications" });
    fireEvent.click(communicationsButton);

    const menu = screen.getByRole("menu", { name: "Communications destinations" });
    expect(screen.getByRole("menuitem", { name: "Unified Inbox" })).toHaveAttribute("href", "/landlord/unified-inbox");
    expect(screen.getByRole("menuitem", { name: "Messages" })).toHaveAttribute("href", "/messages");
    expect(screen.getByRole("menuitem", { name: "Messages" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("menuitem", { name: "Notices" })).toHaveAttribute("href", "/notices");
    expect(menu).toBeInTheDocument();
    expect(menu.parentElement).toBe(document.body);
  });

  it("replaces the prominent account text action with a scheduling shortcut", async () => {
    renderTopNav();

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

    renderTopNav();

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

    renderTopNav();

    expect(await screen.findByRole("button", { name: "Account menu" })).toHaveTextContent("PM");
    expect(screen.queryByText("My Account")).not.toBeInTheDocument();
  });

  it("shows unread indicator from existing conversation unread data", async () => {
    mocks.fetchLandlordConversationsMock.mockResolvedValue([{ id: "conv-1", hasUnread: true }]);

    renderTopNav();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Communications (unread)" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Communications (unread)" }));
    expect(screen.getByRole("menuitem", { name: "Messages, unread activity" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Unified Inbox" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Notices" })).toBeInTheDocument();
  });

  it("shows an Inbox-specific indicator without inventing Messages or Notices state", async () => {
    mocks.fetchUnifiedInboxMock.mockResolvedValue({
      items: [{ id: "maintenance-1", status: "unread", sourceKind: "landlord.maintenance" }],
      records: [],
    });

    renderTopNav();

    const trigger = await screen.findByRole("button", { name: "Communications (unread)" });
    fireEvent.click(trigger);

    expect(screen.getByRole("menuitem", { name: "Unified Inbox, unread activity" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Messages" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Notices" })).toBeInTheDocument();
  });

  it("shows both child indicators while leaving menu navigation non-acknowledging", async () => {
    mocks.fetchLandlordConversationsMock.mockResolvedValue([{ id: "conv-1", hasUnread: true }]);
    mocks.fetchUnifiedInboxMock.mockResolvedValue({
      items: [{ id: "lease-1", status: "unread", sourceKind: "landlord.lease" }],
      records: [],
    });

    renderTopNav();

    fireEvent.click(await screen.findByRole("button", { name: "Communications (unread)" }));
    expect(screen.getByRole("menuitem", { name: "Unified Inbox, unread activity" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Messages, unread activity" })).toBeInTheDocument();
    expect(mocks.fetchLandlordConversationsMock).toHaveBeenCalledTimes(1);
    expect(mocks.fetchUnifiedInboxMock).toHaveBeenCalledTimes(1);
  });

  it("does not duplicate a shared unread message as Inbox-specific activity", async () => {
    mocks.fetchLandlordConversationsMock.mockResolvedValue([{ id: "conv-1", hasUnread: true }]);
    mocks.fetchUnifiedInboxMock.mockResolvedValue({
      items: [{ id: "conv-1", status: "unread", sourceKind: "landlord.message" }],
      records: [],
    });

    renderTopNav();

    fireEvent.click(await screen.findByRole("button", { name: "Communications (unread)" }));
    expect(screen.getByRole("menuitem", { name: "Messages, unread activity" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Unified Inbox" })).toBeInTheDocument();
  });

  it("closes the Communications menu on Escape and restores trigger focus", async () => {
    renderTopNav();

    const trigger = screen.getByRole("button", { name: "Communications" });
    fireEvent.click(trigger);
    expect(screen.getByRole("menu", { name: "Communications destinations" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("menu", { name: "Communications destinations" })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
