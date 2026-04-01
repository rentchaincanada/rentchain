import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScreeningHistoryTable } from "./ScreeningHistoryTable";

const sampleItem = {
  id: "screening_1",
  landlordId: "landlord_1",
  propertyId: "prop_1",
  unitId: "unit_1",
  applicationId: "app_1",
  tenantId: null,
  applicantName: "Jamie Lee",
  provider: "transunion" as const,
  providerReferenceId: "ref_1",
  screeningType: "verify_ai",
  status: "completed" as const,
  result: "approved" as const,
  riskLevel: "low" as const,
  screenedAt: "2026-04-01T10:00:00.000Z",
  requestedAt: "2026-04-01T09:00:00.000Z",
  requestedByUserId: "user_1",
  summary: {
    recommendation: "pass",
    scoreBand: "B",
    confidence: "High",
    openAccounts: 4,
    pastDueTotal: 0,
    collectionsPresent: false,
    bankruptcyPresent: false,
    inquiriesCount: 2,
    flags: ["Thin file"],
    notes: "Summary retained",
  },
  report: {
    status: "available" as const,
    storageMode: "rentchain_encrypted" as const,
    fileRef: "bucket/key.pdf",
    archivedAt: null,
    retrievalCost: null,
    retrievalRequired: false,
  },
  audit: {
    lastViewedAt: null,
    lastViewedByUserId: null,
    accessCount: 0,
  },
  createdAt: null,
  updatedAt: null,
};

describe("ScreeningHistoryTable", () => {
  it("renders screening rows and actions", () => {
    const onViewSummary = vi.fn();
    const onViewReport = vi.fn();
    const onRescreen = vi.fn();

    render(
      <ScreeningHistoryTable
        items={[sampleItem]}
        onViewSummary={onViewSummary}
        onViewReport={onViewReport}
        onRescreen={onRescreen}
      />
    );

    expect(screen.getByText("Jamie Lee - transunion - verify_ai")).toBeInTheDocument();
    expect(screen.getByText("Report available")).toBeInTheDocument();

    fireEvent.click(screen.getByText("View summary"));
    fireEvent.click(screen.getByText("View report"));

    expect(onViewSummary).toHaveBeenCalledWith(sampleItem);
    expect(onViewReport).toHaveBeenCalledWith(sampleItem);
  });

  it("shows an empty state when there are no screenings", () => {
    render(
      <ScreeningHistoryTable
        items={[]}
        onViewSummary={vi.fn()}
        onViewReport={vi.fn()}
        onRescreen={vi.fn()}
      />
    );

    expect(screen.getByText("No screenings yet")).toBeInTheDocument();
    expect(screen.getByText("Start screening")).toBeInTheDocument();
  });
});
