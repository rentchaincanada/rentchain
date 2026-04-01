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
    expect(screen.getByText(/Use your TransUnion membership to enable tenant screening/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Get TransUnion Access" }));
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
      />
    );

    expect(screen.getByText("Status: Connected")).toBeInTheDocument();
    expect(screen.getByText("Member code: *******7788")).toBeInTheDocument();
    expect(screen.queryByText(/PASS-/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Screening" })).toBeInTheDocument();
  });
});
