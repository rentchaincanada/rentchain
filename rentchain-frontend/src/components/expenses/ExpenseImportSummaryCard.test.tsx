import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExpenseImportSummaryCard } from "./ExpenseImportSummaryCard";

describe("ExpenseImportSummaryCard", () => {
  it("renders imported and skipped counts with row-level reasons", () => {
    render(
      <ExpenseImportSummaryCard
        rowsImported={2}
        rowsSkipped={1}
        errors={['Row 4: property "Summit" was not found in your portfolio.']}
      />
    );

    expect(screen.getByText("Import completed with skips")).toBeInTheDocument();
    expect(screen.getByText("2 imported")).toBeInTheDocument();
    expect(screen.getByText("1 skipped")).toBeInTheDocument();
    expect(screen.getByText('Row 4: property "Summit" was not found in your portfolio.')).toBeInTheDocument();
    expect(screen.queryByText(/with imported\/skipped/i)).not.toBeInTheDocument();
  });
});
