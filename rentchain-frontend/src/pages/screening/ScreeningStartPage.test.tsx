import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

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
