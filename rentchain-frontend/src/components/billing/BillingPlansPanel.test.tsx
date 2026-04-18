import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BillingPlansPanel } from "./BillingPlansPanel";

vi.mock("./PlanIntervalToggle", () => ({
  PlanIntervalToggle: ({ value, onChange }: { value: "month" | "year"; onChange: (value: "month" | "year") => void }) => (
    <div>
      <button type="button" onClick={() => onChange(value === "month" ? "year" : "month")}>
        Toggle interval
      </button>
    </div>
  ),
}));

describe("BillingPlansPanel", () => {
  it("emphasizes selected and recommended plans with supporting checkout copy", () => {
    const onSelectPlan = vi.fn();

    render(
      <BillingPlansPanel
        pricing={null}
        pricingLoading={false}
        pricingUnavailable={false}
        interval="year"
        onIntervalChange={vi.fn()}
        currentPlan="starter"
        selectedPlan="pro"
        recommendedPlan="pro"
        role="landlord"
        mode="billing"
        planActionLoading={null}
        onSelectPlan={onSelectPlan}
      />
    );

    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.getByText("Selected from pricing")).toBeInTheDocument();
    expect(screen.getAllByText("Operations and reporting").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "Selected from pricing. Opens secure checkout for the Pro plan you already chose so you can review details and confirm before billing starts."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue to Pro checkout" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue to Elite checkout" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue to Pro checkout" }));
    expect(onSelectPlan).toHaveBeenCalledWith("pro");
  });

  it("marks the next upgrade as recommended when there is no pricing-selected plan", () => {
    render(
      <BillingPlansPanel
        pricing={null}
        pricingLoading={false}
        pricingUnavailable={false}
        interval="month"
        onIntervalChange={vi.fn()}
        currentPlan="starter"
        selectedPlan={null}
        recommendedPlan="pro"
        role="landlord"
        mode="billing"
        planActionLoading={null}
        onSelectPlan={vi.fn()}
      />
    );

    expect(screen.getByText("Recommended next step")).toBeInTheDocument();
    expect(screen.getAllByText("Operations and reporting").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "Recommended next step based on your current plan. Opens secure checkout for operations and reporting so you can review the plan before confirming any change."
      )
    ).toBeInTheDocument();
  });
});
