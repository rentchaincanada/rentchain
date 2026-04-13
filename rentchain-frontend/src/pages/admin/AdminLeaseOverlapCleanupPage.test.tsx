import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminLeaseOverlapCleanupPage from "./AdminLeaseOverlapCleanupPage";

const mocks = vi.hoisted(() => ({
  getAdminLeaseOverlapGroupsMock: vi.fn(),
  previewAdminLeaseOverlapCleanupMock: vi.fn(),
  applyAdminLeaseOverlapCleanupMock: vi.fn(),
  showToastMock: vi.fn(),
}));

vi.mock("../../components/layout/LandlordNav", () => ({
  LandlordNav: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mocks.showToastMock }),
}));

vi.mock("../../api/leaseOverlapCleanupApi", async () => {
  const actual = await vi.importActual<typeof import("../../api/leaseOverlapCleanupApi")>("../../api/leaseOverlapCleanupApi");
  return {
    ...actual,
    getAdminLeaseOverlapGroups: mocks.getAdminLeaseOverlapGroupsMock,
    previewAdminLeaseOverlapCleanup: mocks.previewAdminLeaseOverlapCleanupMock,
    applyAdminLeaseOverlapCleanup: mocks.applyAdminLeaseOverlapCleanupMock,
  };
});

describe("AdminLeaseOverlapCleanupPage", () => {
  beforeEach(() => {
    mocks.showToastMock.mockReset();
    mocks.previewAdminLeaseOverlapCleanupMock.mockReset();
    mocks.applyAdminLeaseOverlapCleanupMock.mockReset();
    mocks.getAdminLeaseOverlapGroupsMock.mockResolvedValue({
      summary: {
        generatedAt: "2026-03-30T00:00:00.000Z",
        overlapGroupCount: 1,
        byType: {
          duplicate_current_same_unitId: 1,
          duplicate_current_same_logical_unit: 0,
          overlapping_dates_same_unit: 0,
          stale_pointer_conflict: 0,
          property_unit_mismatch: 0,
        },
        bySeverity: { high: 1, medium: 0, low: 0 },
      },
      groups: [
        {
          landlordId: "landlord-1",
          propertyId: "prop-1",
          propertyName: "Coburg Rd",
          unitId: "unit-1",
          unitNumber: "3",
          unitLabel: "Unit 3",
          overlapType: "duplicate_current_same_unitId",
          severity: "high",
          confidence: "high",
          leaseIds: ["lease-a", "lease-b"],
          tenantIds: ["tenant-a", "tenant-b"],
          leaseStatuses: ["active", "active"],
          startDates: ["2026-01-01", "2026-02-01"],
          endDates: ["2026-12-31", "2027-01-31"],
          currentLeaseHints: [],
          riskNotes: ["Multiple current leases share the same direct unitId."],
          sourceHints: ["legacy-tenant-migration"],
          recommendedReviewAction: "Review the overlap.",
          generatedAt: "2026-03-30T00:00:00.000Z",
          suggestedCanonicalLeaseId: "lease-b",
          suggestedLoserLeaseIds: ["lease-a"],
          suggestionConfidence: "medium",
          suggestionReasons: ["Includes complete lease dates.", "Looks less like a migration duplicate than competing rows."],
        },
      ],
    });
    mocks.previewAdminLeaseOverlapCleanupMock.mockResolvedValue({
      ok: true,
      preview: {
        dryRun: true,
        landlordId: "landlord-1",
        propertyId: "prop-1",
        canonicalLeaseId: "lease-b",
        targetStatus: "superseded",
        group: null,
        leaseChanges: [{ leaseId: "lease-a", fromStatus: "active", toStatus: "superseded" }],
        tenantChanges: [{ tenantId: "tenant-a", fromCurrentLeaseId: "lease-a", toCurrentLeaseId: "lease-b" }],
      },
    });
    mocks.applyAdminLeaseOverlapCleanupMock.mockResolvedValue({
      ok: true,
      result: {
        dryRun: false,
        applied: true,
        resolutionLogId: "log-1",
        actorUserId: "admin-1",
        appliedAt: "2026-03-30T01:00:00.000Z",
        landlordId: "landlord-1",
        propertyId: "prop-1",
        canonicalLeaseId: "lease-b",
        targetStatus: "superseded",
        group: null,
        leaseChanges: [{ leaseId: "lease-a", fromStatus: "active", toStatus: "superseded" }],
        tenantChanges: [{ tenantId: "tenant-a", fromCurrentLeaseId: "lease-a", toCurrentLeaseId: "lease-b" }],
      },
    });
  });

  it("renders the suggestion card and use suggestion updates the canonical lease selection", async () => {
    render(<AdminLeaseOverlapCleanupPage />);

    expect(await screen.findByText("Suggested cleanup")).toBeInTheDocument();
    expect(screen.getByText("Suggested canonical lease: lease-b")).toBeInTheDocument();

    const leaseARadio = screen.getByLabelText("Select canonical lease lease-a") as HTMLInputElement;
    const leaseBRadio = screen.getByLabelText("Select canonical lease lease-b") as HTMLInputElement;

    await waitFor(() => {
      expect(leaseARadio.checked).toBe(true);
      expect(leaseBRadio.checked).toBe(false);
    });

    fireEvent.click(screen.getByRole("button", { name: "Use suggestion" }));

    await waitFor(() => {
      expect(leaseARadio.checked).toBe(false);
      expect(leaseBRadio.checked).toBe(true);
    });

    fireEvent.click(leaseARadio);
    await waitFor(() => {
      expect(leaseARadio.checked).toBe(true);
    });
  });

  it("still requires preview and confirmation before apply", async () => {
    render(<AdminLeaseOverlapCleanupPage />);

    await screen.findByText("Select canonical lease");

    const applyButton = screen.getAllByRole("button", { name: "Apply cleanup" })[0] as HTMLButtonElement;
    expect(applyButton.disabled).toBe(true);

    fireEvent.click(screen.getAllByRole("button", { name: "Use suggestion" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Preview cleanup" })[0]);

    await waitFor(() => {
      expect(mocks.previewAdminLeaseOverlapCleanupMock).toHaveBeenCalledWith({
        landlordId: "landlord-1",
        propertyId: "prop-1",
        canonicalLeaseId: "lease-b",
        overlapLeaseIds: ["lease-a", "lease-b"],
        targetStatus: "superseded",
      });
    });

    expect(screen.getByText("Preview loaded. Nothing has been changed yet.")).toBeInTheDocument();
    expect(applyButton.disabled).toBe(true);

    fireEvent.click(
      screen.getAllByRole("checkbox", {
        name: /I reviewed the canonical lease/i,
      })[0]
    );

    expect(applyButton.disabled).toBe(false);
  });
});
