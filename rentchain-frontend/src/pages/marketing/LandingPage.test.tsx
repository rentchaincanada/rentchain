import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LandingPage from "./LandingPage";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useAuth: vi.fn(),
  track: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("../../context/useAuth", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("../../lib/analytics", () => ({
  track: mocks.track,
}));

function renderLanding(initialEntry = "/") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/site" element={<LandingPage />} />
        <Route path="/login" element={<div data-testid="login-page">Login page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Marketing LandingPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.navigate.mockReset();
    mocks.useAuth.mockReset();
    mocks.track.mockReset();
    mocks.useAuth.mockImplementation(() => ({ user: null }));
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders at the root route with the handoff hero headline", () => {
    renderLanding("/");

    expect(
      screen.getByRole("heading", { level: 1, name: /Housing operations\. Connected\./i })
    ).toBeInTheDocument();
    expect(screen.getByText(/The operating system for housing/i)).toBeInTheDocument();
    expect(document.body).toHaveAttribute("data-marketing-print-active", "true");
    expect(screen.getByLabelText("Sample connected operating record")).toHaveTextContent("Lease terms approved");
    expect(screen.getByText("One shared record", { selector: ".rc-trust-mobile-connector strong" })).toBeInTheDocument();
  });

  it("removes the landing-only print marker when the route unmounts", () => {
    const view = renderLanding("/");

    view.unmount();

    expect(document.body).not.toHaveAttribute("data-marketing-print-active");
  });

  it("renders at the /site route", () => {
    renderLanding("/site");

    expect(
      screen.getByRole("heading", { level: 1, name: /Housing operations\. Connected\./i })
    ).toBeInTheDocument();
  });

  it("stores source tags and routes unauthenticated users through the existing signup CTA flow", () => {
    renderLanding("/?utm_source=google&utm_medium=cpc&utm_campaign=halifax-ready&utm_content=variant-b");

    fireEvent.click(screen.getAllByRole("button", { name: "Start free" })[0]);

    expect(mocks.navigate).toHaveBeenCalledWith("/signup?next=/properties&intent=registry_readiness");
    expect(mocks.track).toHaveBeenCalledWith(
      "registry_landing_cta_clicked",
      expect.objectContaining({
        source: "google",
        medium: "cpc",
        campaign: "halifax-ready",
        variant: "variant-b",
        location: "landing_hero",
      })
    );
    expect(JSON.parse(window.localStorage.getItem("rentchain:registryAcquisitionAttribution") || "{}")).toEqual(
      expect.objectContaining({
        source: "google",
        medium: "cpc",
        campaign: "halifax-ready",
        variant: "variant-b",
      })
    );
  });

  it("routes authenticated users directly into the properties workflow", () => {
    mocks.useAuth.mockImplementation(() => ({ user: { id: "landlord-1" } }));

    renderLanding("/");

    fireEvent.click(screen.getAllByRole("button", { name: "Start free" })[0]);

    expect(mocks.navigate).toHaveBeenCalledWith("/properties?intent=registry_readiness");
  });

  it("opens the login dropdown with role-specific portal links", () => {
    renderLanding("/");

    const loginButton = screen.getByRole("button", { name: "Log in" });
    expect(loginButton).toHaveAttribute("aria-haspopup", "menu");
    expect(loginButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(loginButton);

    expect(loginButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: /Landlord login/i })).toHaveAttribute(
      "href",
      "/login?role=landlord"
    );
    expect(screen.getByRole("menuitem", { name: /Property manager login/i })).toHaveAttribute(
      "href",
      "/login?role=manager"
    );
    expect(screen.getByRole("menuitem", { name: /Tenant login/i })).toHaveAttribute("href", "/tenant");
    expect(screen.getByRole("menuitem", { name: /Contractor login/i })).toHaveAttribute("href", "/contractor");
  });

  it("keeps the book-demo action on the request access route", () => {
    renderLanding("/");

    expect(screen.getAllByRole("link", { name: "Book a demo" })[0]).toHaveAttribute(
      "href",
      "/site/request-access"
    );
  });

  it("renders a conservative pricing start section with real pricing and CTA routes", () => {
    renderLanding("/");

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /Start free\. Grow when the workflow needs more support\./i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText("First property setup")).toBeInTheDocument();
    expect(screen.getByText("Portfolio-level oversight")).toBeInTheDocument();
    const pricingLink = screen.getByRole("link", { name: "View pricing" });
    expect(pricingLink).toHaveAttribute("href", "/site/pricing#plan-fit");
    expect(window.getComputedStyle(pricingLink).color).toBe("rgb(255, 255, 255)");

    fireEvent.click(screen.getAllByRole("button", { name: "Start free" }).at(-1)!);

    expect(mocks.navigate).toHaveBeenCalledWith("/signup?next=/properties&intent=registry_readiness");
  });

  it("changes the lifecycle active step when a lifecycle control is clicked", () => {
    renderLanding("/");

    expect(screen.getByRole("tab", { name: "Viewing request" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Application & screening" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(8);

    fireEvent.click(screen.getByRole("tab", { name: "Tenant request" }));

    expect(screen.getByRole("tab", { name: "Tenant request" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Tenants submit maintenance requests from their portal");
  });

  it("does not render fake testimonials or unsupported performance metrics", () => {
    renderLanding("/");

    expect(screen.queryByText(/testimonial/i)).not.toBeInTheDocument();
    expect(screen.queryByText("98.4%")).not.toBeInTheDocument();
    expect(screen.queryByText("142")).not.toBeInTheDocument();
    expect(screen.getByText(/Illustrative sample interface data, not company performance claims/i)).toBeInTheDocument();
  });

  it("does not ship placeholder footer links", () => {
    const { container } = renderLanding("/");

    const footerLinks = Array.from(container.querySelectorAll("footer a"));
    const footerPricingLink = screen.getByRole("link", { name: "Pricing" });
    expect(footerLinks.length).toBeGreaterThan(0);
    expect(footerPricingLink).toHaveAttribute("href", "/site/pricing#plan-fit");
    expect(footerLinks.every((link) => link.getAttribute("href") && !link.getAttribute("href")?.startsWith("#"))).toBe(
      true
    );
  });

  it("does not mount landing page styles on the login route", () => {
    const { container } = renderLanding("/login?role=landlord");

    expect(screen.getByTestId("login-page")).toBeInTheDocument();
    expect(container.querySelector(".rc-landing")).not.toBeInTheDocument();
  });
});
