import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ScreeningStatus } from "./ScreeningStatus";

afterEach(() => cleanup());

describe("ScreeningStatus", () => {
  it("renders empty state", () => {
    render(<ScreeningStatus request={null} />);
    expect(screen.getByTestId("screening-status-empty")).toHaveTextContent("No screening request selected.");
  });

  it("renders request status without result payload details", () => {
    render(
      <ScreeningStatus
        request={{
          requestId: "screening-1",
          unitId: "unit-1",
          tenantId: "tenant-1",
          status: "completed",
          initiatedAt: "2026-06-05T00:00:00.000Z",
          resultReceivedAt: "2026-06-05T01:00:00.000Z",
          decisionStatus: "review_needed",
          manualReportUploadedAt: null,
        }}
      />,
    );

    expect(screen.getByText("Result available")).toBeInTheDocument();
    expect(screen.getByText("screening-1")).toBeInTheDocument();
    expect(screen.queryByText(/payload/i)).not.toBeInTheDocument();
  });
});
