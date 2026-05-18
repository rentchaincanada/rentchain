import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TransUnionConnectionCard } from "./TransUnionConnectionCard";
import type { TransUnionIntegration } from "@/api/integrationsApi";

function buildIntegration(overrides: Partial<TransUnionIntegration>): TransUnionIntegration {
  return {
    provider: "transunion",
    status: "not_connected",
    version: 1,
    ...overrides,
  };
}

describe("TransUnionConnectionCard", () => {
  it("renders the not_connected state", () => {
    const onGetAccess = vi.fn();
    render(
      <TransUnionConnectionCard
        integration={buildIntegration({ status: "not_connected" })}
        onGetAccess={onGetAccess}
        onConnectExisting={vi.fn()}
        onEnterDetails={vi.fn()}
        onViewInstructions={vi.fn()}
        onUpdateCredentials={vi.fn()}
        onDisconnect={vi.fn()}
      />
    );

    expect(screen.getByText("TransUnion Connection")).toBeInTheDocument();
    expect(
      screen.getByText(/Start with TransUnion credentialing if you do not have a member code and passcode yet/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText("Not connected")).toHaveLength(2);
    expect(screen.getByText("Connect or get access")).toBeInTheDocument();
    expect(screen.getByText("Ready to screen")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start provider setup" }));
    expect(onGetAccess).toHaveBeenCalledTimes(1);
  });

  it("renders the pending_credentialing state", () => {
    render(
      <TransUnionConnectionCard
        integration={buildIntegration({ status: "pending_credentialing" })}
        onGetAccess={vi.fn()}
        onConnectExisting={vi.fn()}
        onEnterDetails={vi.fn()}
        onViewInstructions={vi.fn()}
        onUpdateCredentials={vi.fn()}
        onDisconnect={vi.fn()}
      />
    );

    expect(
      screen.getByText(/Your TransUnion credentialing is in progress/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Contact TransUnion directly, complete credentialing/i)).toBeInTheDocument();
    expect(screen.getByText(/Next step: finish credentialing with TransUnion/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enter Membership Details" })).toBeInTheDocument();
  });

  it("renders the connected state with the masked member code only", () => {
    render(
      <TransUnionConnectionCard
        integration={buildIntegration({
          status: "connected",
          memberCodeMasked: "*******7788",
          updatedAt: new Date("2026-03-27T12:00:00.000Z").getTime(),
          credentialSource: "membership_credentials",
        })}
        onGetAccess={vi.fn()}
        onConnectExisting={vi.fn()}
        onEnterDetails={vi.fn()}
        onViewInstructions={vi.fn()}
        onUpdateCredentials={vi.fn()}
        onDisconnect={vi.fn()}
        onStartScreening={vi.fn()}
        readyToScreen
        selectedApplicationLabel="Jamie Stone"
        screeningsCompletedCount={2}
        lastScreeningDate={new Date("2026-03-28T12:00:00.000Z").getTime()}
      />
    );

    expect(screen.getByText("Status: Connected")).toBeInTheDocument();
    expect(screen.getByText("Member code: *******7788")).toBeInTheDocument();
    expect(screen.getByText("Screenings completed: 2")).toBeInTheDocument();
    expect(screen.queryByText(/PASS-/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Next Screening" })).toBeInTheDocument();
  });

  it("guides connected landlords to choose an applicant before first screening", () => {
    const onChooseApplicant = vi.fn();
    render(
      <TransUnionConnectionCard
        integration={buildIntegration({
          status: "connected",
          memberCodeMasked: "*******7788",
          updatedAt: new Date("2026-03-27T12:00:00.000Z").getTime(),
          credentialSource: "membership_credentials",
        })}
        onGetAccess={vi.fn()}
        onConnectExisting={vi.fn()}
        onEnterDetails={vi.fn()}
        onViewInstructions={vi.fn()}
        onUpdateCredentials={vi.fn()}
        onDisconnect={vi.fn()}
        onChooseApplicant={onChooseApplicant}
      />
    );

    expect(screen.getByText(/choose an applicant in RentChain to start the screening workflow/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Choose an Applicant" }));
    expect(onChooseApplicant).toHaveBeenCalledTimes(1);
  });

  it("does not render literal null text in the next-step copy", () => {
    render(
      <TransUnionConnectionCard
        integration={buildIntegration({
          status: "connected",
          memberCodeMasked: "*******7788",
        })}
        onGetAccess={vi.fn()}
        onConnectExisting={vi.fn()}
        onEnterDetails={vi.fn()}
        onViewInstructions={vi.fn()}
        onUpdateCredentials={vi.fn()}
        onDisconnect={vi.fn()}
        onStartScreening={vi.fn()}
        readyToScreen
        selectedApplicationLabel={"null" as any}
      />
    );

    expect(screen.queryByText(/null\/null/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bnull\b/i)).not.toBeInTheDocument();
  });
});
