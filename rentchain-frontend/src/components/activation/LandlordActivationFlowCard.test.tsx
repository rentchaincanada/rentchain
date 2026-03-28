import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LandlordActivationFlowCard } from "./LandlordActivationFlowCard";
import type { LandlordActivationSummary } from "@/api/activationApi";

function buildSummary(): LandlordActivationSummary {
  return {
    completedCount: 2,
    totalCount: 7,
    nextStepKey: "applicant",
    steps: [
      {
        key: "property",
        title: "Add Property",
        status: "completed",
        description: "Add your first rental property to begin onboarding applicants.",
        actionLabel: "Add Property",
        actionPath: "/properties",
      },
      {
        key: "unit",
        title: "Add Unit",
        status: "completed",
        description: "Add at least one unit so applicants can be linked to a rentable space.",
        actionLabel: "Add Unit",
        actionPath: "/properties",
      },
      {
        key: "applicant",
        title: "Add or Invite Applicant",
        status: "in_progress",
        description: "Create or invite your first applicant to begin the tenant workflow.",
        actionLabel: "Add Applicant",
        actionPath: "/applications?openSendApplication=1&autoSelectProperty=1",
      },
      {
        key: "viewing",
        title: "Request Viewing",
        status: "blocked",
        description: "Add or invite an applicant before requesting a viewing.",
        actionLabel: "Add Applicant",
        actionPath: "/applications?openSendApplication=1&autoSelectProperty=1",
      },
      {
        key: "transunion",
        title: "Connect TransUnion",
        status: "blocked",
        description: "Request a viewing before connecting TransUnion for screening.",
        actionLabel: "Request Viewing",
        actionPath: "/applications?applicationId=app-1",
      },
      {
        key: "screening",
        title: "Start Screening",
        status: "blocked",
        description: "Connect TransUnion before starting screening.",
        actionLabel: "Connect TransUnion",
        actionPath: "/applications?applicationId=app-1&openTransUnionConnect=1",
      },
      {
        key: "decision",
        title: "Review Decision",
        status: "blocked",
        description: "Start screening before reviewing a decision summary.",
        actionLabel: "Connect TransUnion",
        actionPath: "/applications?applicationId=app-1&openTransUnionConnect=1",
      },
    ],
  };
}

describe("LandlordActivationFlowCard", () => {
  it("renders progress and step labels", () => {
    render(
      <MemoryRouter>
        <LandlordActivationFlowCard summary={buildSummary()} />
      </MemoryRouter>
    );

    expect(screen.getByText("Get your first tenant screened")).toBeInTheDocument();
    expect(screen.getByText("2 of 7 steps complete")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add Applicant" }).length).toBeGreaterThan(0);
  });

  it("renders completed and blocked badges", () => {
    render(
      <MemoryRouter>
        <LandlordActivationFlowCard summary={buildSummary()} />
      </MemoryRouter>
    );

    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Blocked").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Next step").length).toBeGreaterThan(0);
  });

  it("shows the transunion action label on the screening blocker", () => {
    render(
      <MemoryRouter>
        <LandlordActivationFlowCard summary={buildSummary()} />
      </MemoryRouter>
    );

    expect(screen.getAllByRole("button", { name: "Connect TransUnion" }).length).toBeGreaterThan(0);
  });
});
