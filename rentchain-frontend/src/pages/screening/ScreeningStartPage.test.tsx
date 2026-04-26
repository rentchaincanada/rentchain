import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/apiFetch", () => ({
  apiFetch: vi.fn(async () => ({
    error: "transunion_not_connected",
    message: "Connect your TransUnion membership before starting screening.",
  })),
}));

vi.mock("../../context/useAuth", () => ({
  useAuth: () => ({
    user: { id: "landlord-1", role: "landlord", actorRole: "landlord" },
  }),
}));

vi.mock("../../hooks/useBillingStatus", () => ({
  useBillingStatus: () => ({ tier: "pro" }),
}));

vi.mock("../../features/upgradeNudges/nudgeStore", () => ({
  canShowNudge: () => false,
  hasMeaningfulAction: () => false,
  markNudgeDismissed: vi.fn(),
  markNudgeShown: vi.fn(),
}));

vi.mock("../../api/telemetryApi", () => ({
  logTelemetryEvent: vi.fn(),
}));

vi.mock("../../billing/openUpgradeFlow", () => ({
  openUpgradeFlow: vi.fn(),
}));

import ScreeningStartPage from "./ScreeningStartPage";

afterEach(() => {
  cleanup();
});

describe("ScreeningStartPage", () => {
  it("shows the TransUnion interstitial when TransUnion is not connected", async () => {
    render(
      <MemoryRouter initialEntries={["/screening/start?applicationId=app-1"]}>
        <ScreeningStartPage />
      </MemoryRouter>
    );

    expect((await screen.findAllByText("Connect TransUnion to start screening")).length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "Before you can screen a tenant in RentChain, connect your TransUnion membership credentials."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect TransUnion" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get Access" })).toBeInTheDocument();
  });
});

describe("ScreeningStartPage edge guidance", () => {
  it("shows deterministic guidance when a checkout already exists", async () => {
    const { apiFetch } = await import("../../api/apiFetch");
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      errorCode: "SCREENING_CHECKOUT_ALREADY_EXISTS",
      screeningMonetizationSummary: {
        blockingReason: "SCREENING_CHECKOUT_ALREADY_EXISTS",
      },
    } as any);

    render(
      <MemoryRouter initialEntries={["/screening/start?applicationId=app-1"]}>
        <ScreeningStartPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Checkout already created")).toBeInTheDocument();
    expect(
      screen.getByText(
        "A screening checkout already exists for this application. Return to the application to review the current payment state."
      )
    ).toBeInTheDocument();
  });

  it("shows already-paid status instead of a retry message", async () => {
    const { apiFetch } = await import("../../api/apiFetch");
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      errorCode: "SCREENING_ALREADY_PAID",
      screeningMonetizationSummary: {
        blockingReason: "SCREENING_ALREADY_PAID",
      },
    } as any);

    render(
      <MemoryRouter initialEntries={["/screening/start?applicationId=app-1"]}>
        <ScreeningStartPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Screening already paid")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Back to application" }).length).toBeGreaterThan(0);
  });
});
