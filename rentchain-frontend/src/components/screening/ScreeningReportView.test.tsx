import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScreeningReportView } from "./ScreeningReportView";

describe("ScreeningReportView", () => {
  it("renders recommendation, flags, actions, and completed state", () => {
    const onDownload = vi.fn();

    render(
      <ScreeningReportView
        applicantName="Jordan Lee"
        propertyLabel="Harbour Lofts"
        unitLabel="Unit 3B"
        status="completed"
        provider="transunion_manual"
        completedAt="2026-03-29T12:00:00.000Z"
        recommendation="Caution"
        riskGrade="B"
        confidence="82%"
        findings={[
          { key: "credit", title: "Credit summary", value: "Moderate risk", helper: "Two items need review." },
          { key: "lease", title: "Lease conflict", value: "No current conflict", helper: "No overlapping lease found." },
          { key: "income", title: "Income / employment", value: "Verified employment", helper: "Income supports rent." },
          { key: "completeness", title: "Completeness", value: "Complete", helper: "Consent and profile received." },
        ]}
        flags={[
          { key: "thin", label: "Thin file", description: "Limited bureau history was available." },
          { key: "address", label: "Address gap", description: "Previous address duration needs confirmation." },
        ]}
        recommendedActions={["Verify current address history", "Confirm employment start date"]}
        actions={[
          { key: "view", label: "View Report", href: "https://example.com/report" },
          { key: "download", label: "Download", onClick: onDownload },
        ]}
        details="Detailed screening notes"
      />
    );

    expect(screen.getByText("Caution")).toBeInTheDocument();
    expect(screen.getByText("Thin file")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Report" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
    expect(screen.getByText(/Completed:/i)).toBeInTheDocument();
  });
});
