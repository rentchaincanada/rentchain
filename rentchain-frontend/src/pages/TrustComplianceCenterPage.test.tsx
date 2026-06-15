import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TrustComplianceCenterPage from "./TrustComplianceCenterPage";

const apiMocks = vi.hoisted(() => ({
  fetchTrustComplianceSummary: vi.fn(),
  showToast: vi.fn(),
  macShellProps: vi.fn(),
}));

vi.mock("@/api/trustComplianceApi", async () => {
  const actual = await vi.importActual<any>("@/api/trustComplianceApi");
  return {
    ...actual,
    fetchTrustComplianceSummary: apiMocks.fetchTrustComplianceSummary,
  };
});

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({
    showToast: apiMocks.showToast,
  }),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children, ...props }: { children: React.ReactNode; showTopNav?: boolean }) => {
    apiMocks.macShellProps(props);
    return <div>{children}</div>;
  },
}));

function section(key: string, label: string, overrides: Record<string, unknown> = {}) {
  return {
    key,
    label,
    status: "needs_attention",
    count: 0,
    lastActivityAt: null,
    sourceAvailability: "empty",
    items: [],
    emptyState: `No ${label.toLowerCase()} records yet.`,
    ...overrides,
  };
}

function summary(overrides: Record<string, unknown> = {}) {
  return {
    version: "trust_compliance_center_v1",
    generatedAt: "2026-06-15T00:00:00.000Z",
    landlordId: "landlord-1",
    overallStatus: "needs_attention",
    sections: [
      section("evidence_exports", "Evidence & Exports", {
        status: "ready",
        count: 2,
        lastActivityAt: "2026-06-14T11:00:00.000Z",
        sourceAvailability: "available",
        items: [
          {
            label: "Lease institutional evidence export generated",
            description: "lease.institutional_export_generated",
            eventType: "lease.institutional_export_generated",
            action: "institutional_export_generated",
            status: "generated",
            occurredAt: "2026-06-14T11:00:00.000Z",
            safeMetadata: {
              exportReason: "tribunal",
              exportScope: "lease_evidence_package",
              exportFormat: "pdf",
              manifestHash: "a".repeat(64),
              storagePath: "gs://private/raw.pdf",
            },
          },
        ],
      }),
      section("consent", "Consent"),
      section("privacy", "Privacy"),
      section("retention", "Retention"),
      section("screening", "Screening"),
      section("audit_trail", "Audit Trail"),
      section("incident_readiness", "Breach / Incident Readiness"),
    ],
    recentAuditTrail: [
      {
        label: "rawFirestoreDocId123456",
        description: "gs://private/raw.pdf",
        occurredAt: "2026-06-14T11:00:00.000Z",
      },
    ],
    redactions: ["Raw Firestore document IDs are not used as human-facing labels."],
    ...overrides,
  };
}

describe("TrustComplianceCenterPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    apiMocks.fetchTrustComplianceSummary.mockResolvedValue(summary());
  });

  it("renders all read-only sections, counts, safe metadata, and empty states", async () => {
    render(<TrustComplianceCenterPage />);

    expect(await screen.findByRole("heading", { name: "Trust & Compliance Center" })).toBeInTheDocument();
    expect(screen.getByText("Evidence & Exports")).toBeInTheDocument();
    expect(screen.getByText(/2 records/i)).toBeInTheDocument();
    expect(screen.getByText("Consent")).toBeInTheDocument();
    expect(screen.getByText("No consent records yet.")).toBeInTheDocument();
    expect(screen.getByText("Privacy")).toBeInTheDocument();
    expect(screen.getByText("Retention")).toBeInTheDocument();
    expect(screen.getByText("Screening")).toBeInTheDocument();
    expect(screen.getByText("Audit Trail")).toBeInTheDocument();
    expect(screen.getByText("Breach / Incident Readiness")).toBeInTheDocument();
    expect(screen.getByText(/Export Reason: tribunal/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Manifest Hash: ${"a".repeat(64)}`))).toBeInTheDocument();
    expect(screen.getByText("Recent Audit Trail")).toBeInTheDocument();
    expect(screen.getAllByText("Governance summary").length).toBeGreaterThan(0);
    expect(screen.getByText("Metadata-only summary")).toBeInTheDocument();
    expect(apiMocks.macShellProps).toHaveBeenCalledWith(expect.objectContaining({ showTopNav: false }));

    expect(screen.queryByText(/rawFirestoreDocId123456/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/gs:\/\/private/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/storagePath/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("renders loading and error states", async () => {
    apiMocks.fetchTrustComplianceSummary.mockRejectedValueOnce(new Error("network failed"));
    render(<TrustComplianceCenterPage />);

    expect(screen.getByText("Loading trust and compliance summary...")).toBeInTheDocument();
    expect(await screen.findByText("We couldn't load trust and compliance summary right now.")).toBeInTheDocument();
    expect(apiMocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Failed to load trust and compliance summary",
        description: "network failed",
        variant: "error",
      })
    );
  });
});
