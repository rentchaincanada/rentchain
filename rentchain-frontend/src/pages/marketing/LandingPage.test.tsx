import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

vi.mock("./MarketingLayout", () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("Marketing LandingPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.navigate.mockReset();
    mocks.useAuth.mockReset();
    mocks.track.mockReset();
    mocks.useAuth.mockImplementation(() => ({ user: null }));
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the landlord-first value proposition and free versus paid framing", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: "Keep your properties, tenants, and to-dos organized in one place." })
    ).toBeInTheDocument();
    expect(screen.getByText(/Free lets you organize a property, see what is missing/i)).toBeInTheDocument();
    expect(screen.getByText(/Paid plans unlock stronger day-to-day tools/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Get started with a property" }).length).toBeGreaterThan(0);
  });

  it("stores source tags and routes unauthenticated users into the product signup flow", () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/",
            search: "?utm_source=google&utm_medium=cpc&utm_campaign=halifax-ready&utm_content=variant-b",
          },
        ]}
      >
        <LandingPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Get started with a property" })[0]);

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

    render(
      <MemoryRouter initialEntries={["/"]}>
        <LandingPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Get started with a property" })[0]);

    expect(mocks.navigate).toHaveBeenCalledWith("/properties?intent=registry_readiness");
  });
});
