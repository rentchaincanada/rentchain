import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExpenseImportSummaryCard } from "./ExpenseImportSummaryCard";

describe("ExpenseImportSummaryCard", () => {
  it("renders imported and skipped counts with row-level reasons", () => {
    render(
      <ExpenseImportSummaryCard
        rowsImported={2}
        rowsSkipped={1}
        duplicateImported={1}
        errors={['Row 4: property "Summit" was not found in your portfolio.']}
      />
    );

    expect(screen.getByText("Import completed with skips")).toBeInTheDocument();
    expect(screen.getByText("2 imported")).toBeInTheDocument();
    expect(screen.getByText("1 skipped")).toBeInTheDocument();
    expect(screen.getByText("1 duplicate-flagged imported")).toBeInTheDocument();
    expect(screen.getByText('Row 4: property "Summit" was not found in your portfolio.')).toBeInTheDocument();
    expect(screen.queryByText(/with imported\/skipped/i)).not.toBeInTheDocument();
  });

  it("renders preview counts cleanly for review mode", () => {
    render(
      <ExpenseImportSummaryCard
        parsed={4}
        lowConfidence={2}
        unresolvedProperty={1}
        unresolvedUnit={1}
        duplicateCount={2}
        likelyDuplicateCount={1}
        selectedCount={2}
        skippedCount={2}
      />
    );

    expect(screen.getByText("Import review summary")).toBeInTheDocument();
    expect(screen.getByText("4 parsed")).toBeInTheDocument();
    expect(screen.getByText("2 low confidence")).toBeInTheDocument();
    expect(screen.getByText("2 duplicate flagged")).toBeInTheDocument();
    expect(screen.getByText("1 likely duplicate")).toBeInTheDocument();
    expect(screen.getByText("1 property needs review")).toBeInTheDocument();
    expect(screen.getByText("1 unit needs review")).toBeInTheDocument();
    expect(screen.getByText("2 selected for import")).toBeInTheDocument();
    expect(screen.getByText("2 skipped for now")).toBeInTheDocument();
  });
});
