import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./LoginPage";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  loginDemo: vi.fn(),
  showToast: vi.fn(),
  trackAuthEvent: vi.fn(),
}));

vi.mock("../context/useAuth", () => ({
  useAuth: () => ({
    login: mocks.login,
    loginDemo: mocks.loginDemo,
    user: null,
    isLoading: false,
    isTwoFactorRequired: false,
  }),
}));

vi.mock("../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock("../lib/authAnalytics", () => ({
  trackAuthEvent: mocks.trackAuthEvent,
}));

describe("LoginPage", () => {
  beforeEach(() => {
    cleanup();
    mocks.login.mockReset();
    mocks.loginDemo.mockReset();
    mocks.showToast.mockReset();
    mocks.trackAuthEvent.mockReset();
    mocks.login.mockResolvedValue({ requires2fa: false });
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("renders the shared landlord and contractor login form", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Sign in to RentChain" })).toBeInTheDocument();
    expect(screen.getByText("Landlord and contractor access")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create free account" })).toHaveAttribute(
      "href",
      "/signup"
    );
    expect(screen.getByRole("link", { name: "Are you a tenant? Access your profile" })).toHaveAttribute(
      "href",
      "/tenant"
    );
  });

  it("submits credentials through the existing auth hook", async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "landlord@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(mocks.login).toHaveBeenCalledWith("landlord@example.com", "secret-password", undefined);
    });
  });

  it("routes PM company login responses to PM company management instead of dashboard", async () => {
    mocks.login.mockResolvedValueOnce({
      requires2fa: false,
      user: {
        id: "pm-company-admin-1",
        email: "admin+propertymanager@rentchain.ai",
        role: "property_manager_company",
        landlordId: null,
      },
    });

    render(
      <MemoryRouter initialEntries={["/login?next=/dashboard"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>Landlord dashboard</div>} />
          <Route
            path="/property-manager-companies/management"
            element={<div>PM Company Management</div>}
          />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "admin+propertymanager@rentchain.ai" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "safe-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("PM Company Management")).toBeInTheDocument();
    expect(screen.queryByText("Landlord dashboard")).not.toBeInTheDocument();
  });

  it("shows expired session context without changing auth behavior", () => {
    render(
      <MemoryRouter initialEntries={["/login?reason=expired"]}>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Session expired")).toBeInTheDocument();
    expect(screen.getByText("Please log in again.")).toBeInTheDocument();
  });

  it("shows invite context when a contractor invite redirect is present", () => {
    render(
      <MemoryRouter initialEntries={["/login?next=/contractor/invite/safe-token"]}>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Contractor invitation detected")).toBeInTheDocument();
  });

  it("preserves delegated access acceptance redirect when linking to signup", () => {
    render(
      <MemoryRouter initialEntries={["/login?next=/delegated-access/accept%3Ftoken%3Dsafe-token"]}>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Delegated access invitation detected")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create free account" })).toHaveAttribute(
      "href",
      "/signup?next=%2Fdelegated-access%2Faccept%3Ftoken%3Dsafe-token"
    );
  });
});
