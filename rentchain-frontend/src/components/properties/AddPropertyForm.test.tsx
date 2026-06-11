import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddPropertyForm } from "./AddPropertyForm";

const mocks = vi.hoisted(() => ({
  createPropertyMock: vi.fn(),
  trackMock: vi.fn(),
  setOnboardingStepMock: vi.fn(),
  showToastMock: vi.fn(),
  useAuthMock: vi.fn(),
  previewUnitsCsvMock: vi.fn(),
}));

vi.mock("../../api/propertiesApi", () => ({
  createProperty: mocks.createPropertyMock,
}));

vi.mock("../../api/onboardingApi", () => ({
  setOnboardingStep: mocks.setOnboardingStepMock,
}));

vi.mock("../../api/unitsImportApi", () => ({
  previewUnitsCsv: mocks.previewUnitsCsvMock,
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
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mocks.createPropertyMock.mockReset();
    mocks.createPropertyMock.mockResolvedValue({
      property: { id: "prop-1", name: "Created Property", portfolioStatus: "active" },
    });
    mocks.trackMock.mockReset();
    mocks.setOnboardingStepMock.mockResolvedValue(undefined);
    mocks.showToastMock.mockReset();
    mocks.previewUnitsCsvMock.mockResolvedValue({
      ok: true,
      headers: {
        valid: true,
        received: ["unitNumber", "marketRent", "beds", "baths", "sqft", "status"],
        expected: ["unitNumber", "marketRent", "beds", "baths", "sqft", "status"],
        missing: [],
        unknown: [],
      },
      preview: {
        errors: [],
        rows: [
          {
            row: 2,
            status: "valid",
            unitNumber: "101",
            data: { unitNumber: "101", rent: 1850, bedrooms: 1, bathrooms: 1, sqft: 610, status: "vacant" },
            issues: [],
          },
        ],
      },
    });
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

  it("previews CSV units through the backend parser before creating the property", async () => {
    const { container } = render(<AddPropertyForm onCreated={vi.fn()} />);

    fireEvent.change(screen.getAllByPlaceholderText("123 Main Street")[0], {
      target: { value: "123 Main Street" },
    });
    fireEvent.change(screen.getAllByPlaceholderText("Halifax")[0], {
      target: { value: "Halifax" },
    });
    fireEvent.change(screen.getAllByRole("spinbutton")[0], {
      target: { value: "1" },
    });
    const unitsToggle = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Units & Rents (Optional)")
    );
    expect(unitsToggle).toBeTruthy();
    fireEvent.click(unitsToggle!);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["unitNumber,marketRent\n101,1850"], "units.csv", { type: "text/csv" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mocks.previewUnitsCsvMock).toHaveBeenCalledWith("unitNumber,marketRent\n101,1850");
    });
    expect(await screen.findByText(/CSV preview: units.csv/i)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Create property" })[0]);

    await waitFor(() => {
      expect(mocks.createPropertyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          totalUnits: 1,
          units: [
            expect.objectContaining({
              unitNumber: "101",
              rent: 1850,
              bedrooms: 1,
              bathrooms: 1,
              sqft: 610,
              status: "vacant",
            }),
          ],
        })
      );
    });
  });
});
