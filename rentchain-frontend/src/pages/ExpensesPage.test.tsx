import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExpensesPage from "./ExpensesPage";

const mocks = vi.hoisted(() => ({
  listExpensesMock: vi.fn(),
  fetchPropertiesMock: vi.fn(),
  useCapabilitiesMock: vi.fn(),
}));

vi.mock("../api/expensesApi", async () => {
  const actual = await vi.importActual<typeof import("../api/expensesApi")>("../api/expensesApi");
  return {
    ...actual,
    listExpenses: mocks.listExpensesMock,
    exportExpenses: vi.fn(),
    importExpensesCsv: vi.fn(),
  };
});

vi.mock("../api/propertiesApi", () => ({
  fetchProperties: mocks.fetchPropertiesMock,
}));

vi.mock("../hooks/useCapabilities", () => ({
  useCapabilities: mocks.useCapabilitiesMock,
}));

vi.mock("../components/expenses/AddExpenseModal", () => ({
  AddExpenseModal: () => null,
}));

describe("ExpensesPage", () => {
  beforeEach(() => {
    mocks.listExpensesMock.mockResolvedValue([
      {
        id: "expense-1",
        propertyId: "prop-1",
        unitId: null,
        category: "Repairs",
        vendorName: "FixIt",
        amountCents: 12500,
        incurredAtMs: Date.parse("2026-03-01T00:00:00.000Z"),
        status: "recorded",
      },
    ]);
    mocks.fetchPropertiesMock.mockResolvedValue({
      items: [{ id: "prop-1", name: "Alpha Property", portfolioStatus: "active" }],
    });
  });

  it("shows the Pro upgrade prompt for import/export on free plans", async () => {
    mocks.useCapabilitiesMock.mockReturnValue({
      caps: { plan: "free" },
      features: { "expenses.import": false },
      loading: false,
    });

    render(<ExpensesPage />);

    expect(await screen.findAllByText("Upgrade to Pro for CSV import and accountant-ready exports.")).toHaveLength(2);
    expect(screen.getAllByText("Alpha Property").length).toBeGreaterThan(0);
  });

  it("shows export controls for Pro plans", async () => {
    mocks.useCapabilitiesMock.mockReturnValue({
      caps: { plan: "pro" },
      features: { "expenses.import": true },
      loading: false,
    });

    render(<ExpensesPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Export CSV" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Export Spreadsheet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export PDF" })).toBeInTheDocument();
  });
});
