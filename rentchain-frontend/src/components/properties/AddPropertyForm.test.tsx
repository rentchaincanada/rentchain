import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddPropertyForm } from "./AddPropertyForm";

const mocks = vi.hoisted(() => ({
  createPropertyMock: vi.fn(),
  trackMock: vi.fn(),
  setOnboardingStepMock: vi.fn(),
  showToastMock: vi.fn(),
  useAuthMock: vi.fn(),
}));

vi.mock("../../api/propertiesApi", () => ({
  createProperty: mocks.createPropertyMock,
}));

vi.mock("../../api/onboardingApi", () => ({
  setOnboardingStep: mocks.setOnboardingStepMock,
}));

vi.mock("../../lib/analytics", () => ({
  track: mocks.trackMock,
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mocks.showToastMock }),
}));

vi.mock("../../context/useAuth", () => ({
  useAuth: mocks.useAuthMock,
}));

describe("AddPropertyForm", () => {
  beforeEach(() => {
    mocks.createPropertyMock.mockResolvedValue({
      property: { id: "prop-1", name: "Created Property", portfolioStatus: "active" },
    });
    mocks.trackMock.mockReset();
    mocks.setOnboardingStepMock.mockResolvedValue(undefined);
    mocks.showToastMock.mockReset();
    mocks.useAuthMock.mockReturnValue({
      user: { id: "user-1", plan: "free", role: "landlord" },
    });
  });

  it("starts with a lighter first-property path and hides optional unit details", () => {
    render(<AddPropertyForm />);

    expect(screen.getByText("Only three details are required to get started")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Enter the street address, city, and total units. You can add amenities, unit details, and compliance information after your first property is set up."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create property" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Units & Rents \(Optional\).*Add details now/i })
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("1800")).not.toBeInTheDocument();
  });

  it("submits the first-property path with only the required fields", async () => {
    render(<AddPropertyForm onCreated={vi.fn()} />);

    fireEvent.change(screen.getAllByPlaceholderText("123 Main Street")[0], {
      target: { value: "123 Main Street" },
    });
    fireEvent.change(screen.getAllByPlaceholderText("Halifax")[0], {
      target: { value: "Halifax" },
    });
    fireEvent.change(screen.getAllByRole("spinbutton")[0], {
      target: { value: "3" },
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Create property" })[0]);

    await waitFor(() => {
      expect(mocks.createPropertyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          addressLine1: "123 Main Street",
          city: "Halifax",
          totalUnits: 3,
          units: undefined,
        })
      );
    });

    await waitFor(() => {
      expect(mocks.trackMock).toHaveBeenCalledWith(
        "activation_property_created",
        expect.objectContaining({
          surface: "properties_page",
          source: "add_property_form",
          plan: "free",
        })
      );
    });
  });
});
