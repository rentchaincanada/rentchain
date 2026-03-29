import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExpenseImportReviewTable } from "./ExpenseImportReviewTable";

describe("ExpenseImportReviewTable", () => {
  it("renders duplicate status, confidence, and warnings", () => {
    const onChangeRow = vi.fn();

    render(
      <ExpenseImportReviewTable
        rows={[
          {
            rowId: "row-1",
            date: "2026-03-01",
            property: "Coburg Rd",
            propertyId: "prop-1",
            unit: null,
            unitId: null,
            category: "Repairs",
            vendor: "FixIt",
            description: "Pipe repair",
            amount: 125,
            currency: "CAD",
            notes: null,
            sourceFileName: "receipt.pdf",
            confidence: 0.42,
            warnings: ["Missing property match", "Likely duplicate of an existing expense."],
            warningCodes: ["unresolved_property", "likely_duplicate"],
            duplicateStatus: "likely_duplicate",
            duplicateReason: "Likely duplicate of an existing expense.",
            duplicateMatches: [
              {
                expenseId: "expense-1",
                source: "existing",
                date: "2026-03-01",
                vendor: "FixIt",
                amount: 125,
                property: "Coburg Rd",
              },
            ],
            lowConfidence: true,
            include: false,
          },
        ]}
        properties={[{ id: "prop-1", name: "Coburg Rd" }]}
        onChangeRow={onChangeRow}
      />
    );

    expect(screen.getByText("Likely duplicate")).toBeInTheDocument();
    expect(screen.getByText(/Low 42%/)).toBeInTheDocument();
    expect(screen.getByText(/Missing property match/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChangeRow).toHaveBeenCalledWith("row-1", { include: true });
  });
});
