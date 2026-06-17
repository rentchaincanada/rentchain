import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LeaseSigningDashboard from "./LeaseSigningDashboard";
import {
  generatePrimaryLeaseDocument,
  getPrimaryLeaseDocument,
  getLeaseSigningStatus,
  sendLeaseForSignature,
  type PrimaryLeaseDocument,
  type LeaseSigningStatusResponse,
} from "../api/leasesApi";

vi.mock("../api/leasesApi", () => ({
  cancelLeaseSigning: vi.fn(),
  downloadSignedLease: vi.fn(),
  generatePrimaryLeaseDocument: vi.fn(),
  getPrimaryLeaseDocument: vi.fn(),
  getLeaseSigningStatus: vi.fn(),
  sendLeaseForSignature: vi.fn(),
}));

const notStartedStatus: LeaseSigningStatusResponse = {
  signingStatus: "not_started",
  derivedLeaseState: "draft",
  signingProviderId: null,
  signingRequestId: null,
  sentAt: null,
  signedAt: null,
  documentUrl: null,
  events: [],
};

const pendingStatus: LeaseSigningStatusResponse = {
  ...notStartedStatus,
  signingStatus: "pending_signature",
  signingProviderId: "mock",
  signingRequestId: "lsr_landlord_lease",
  providerDispatchMode: "mock",
  providerDispatchStatus: "mocked_no_email",
  providerDispatchMessage: "Mock signing provider recorded the request without sending email.",
  sentAt: "2026-06-14T12:00:00.000Z",
};

const primaryDocument: PrimaryLeaseDocument = {
  id: "ldoc_safe",
  leaseId: "lease-1",
  landlordId: "landlord-1",
  tenantIds: ["tenant-1"],
  documentType: "primary_lease",
  jurisdictionCode: "CA_NS",
  templateVersion: "ca-ns-primary-lease-draft-v1",
  templateEffectiveDate: "2026-06-15",
  counselReviewStatus: "draft",
  sourceReferences: ["Nova Scotia Form P Standard Lease Form reference upload"],
  generatedAt: "2026-06-15T12:00:00.000Z",
  generatedBy: "actor-1",
  documentHash: "a".repeat(64),
  manifestHash: "b".repeat(64),
  providerAccessUrlExpiresAt: null,
  status: "generated",
  lockedAt: null,
  lockedBy: null,
  signingRequestId: null,
  storageRef: null,
  leaseReadiness: {
    version: "ns_form_p_readiness_v1",
    jurisdictionCode: "CA_NS",
    overallStatus: "incomplete",
    completionPercent: 58,
    missingFields: [
      { sectionKey: "parties", fieldKey: "occupants", label: "Occupants/adult occupants/children" },
      { sectionKey: "term", fieldKey: "term_type", label: "Term type" },
      { sectionKey: "rent_payments", fieldKey: "due_day", label: "Due day" },
      { sectionKey: "service_notices", fieldKey: "tenant_service_email", label: "Tenant service email" },
      { sectionKey: "service_notices", fieldKey: "tenant_email_service_consent", label: "Tenant email service consent" },
      { sectionKey: "service_notices", fieldKey: "landlord_email_service_consent", label: "Landlord email service consent" },
    ],
    blockingItems: [
      { sectionKey: "parties", fieldKey: "occupants", label: "Occupants/adult occupants/children" },
      { sectionKey: "term", fieldKey: "term_type", label: "Term type" },
      { sectionKey: "rent_payments", fieldKey: "due_day", label: "Due day" },
      { sectionKey: "service_notices", fieldKey: "tenant_service_email", label: "Tenant service email" },
      { sectionKey: "service_notices", fieldKey: "tenant_email_service_consent", label: "Tenant email service consent" },
      { sectionKey: "service_notices", fieldKey: "landlord_email_service_consent", label: "Landlord email service consent" },
    ],
    nonBlockingItems: [{ sectionKey: "term", fieldKey: "public_housing", label: "Public housing", status: "pending" }],
    sectionStatuses: [
      {
        key: "parties",
        label: "Parties",
        status: "incomplete",
        completionPercent: 80,
      },
    ],
  },
  sourceSummary: {
    adapterStatus: "draft",
    signingEnabled: false,
    productionApproved: false,
    templateEffectiveDate: "2026-06-15",
    sourceReferences: ["Nova Scotia Form P Standard Lease Form reference upload"],
  },
};

describe("LeaseSigningDashboard", () => {
  beforeEach(() => {
    vi.mocked(getLeaseSigningStatus).mockResolvedValue(notStartedStatus);
    vi.mocked(getPrimaryLeaseDocument).mockResolvedValue(primaryDocument);
    vi.mocked(generatePrimaryLeaseDocument).mockResolvedValue(primaryDocument);
    vi.mocked(sendLeaseForSignature).mockResolvedValue(pendingStatus);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("submits successfully when tenant email arrives after the dashboard mounts", async () => {
    const { rerender } = render(<LeaseSigningDashboard leaseId="lease-1" tenantEmail={null} />);
    expect(screen.getByRole("button", { name: /send for signature/i })).toBeDisabled();

    rerender(<LeaseSigningDashboard leaseId="lease-1" tenantEmail="tenant@example.com" />);

    await waitFor(() => expect(screen.getByLabelText(/tenant email/i)).toHaveValue("tenant@example.com"));
    expect(screen.getByRole("button", { name: /send for signature/i })).toBeEnabled();

    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: "Please sign this lease." } });
    fireEvent.click(screen.getByRole("button", { name: /send for signature/i }));

    await waitFor(() => {
      expect(sendLeaseForSignature).toHaveBeenCalledWith("lease-1", {
        tenantEmails: ["tenant@example.com"],
        message: "Please sign this lease.",
      });
    });
    await waitFor(() => expect(screen.getByText(/status: pending signature/i)).toBeInTheDocument());
    expect(screen.getByText(/no signature email was sent/i)).toBeInTheDocument();
  });

  it("shows validation failures returned by the signing endpoint", async () => {
    vi.mocked(sendLeaseForSignature).mockRejectedValueOnce({ body: { error: "invalid_tenant_email" } });
    render(<LeaseSigningDashboard leaseId="lease-1" tenantEmail="invalid-email" />);

    await waitFor(() => expect(screen.getByRole("button", { name: /send for signature/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /send for signature/i }));

    await waitFor(() => expect(screen.getByText("invalid_tenant_email")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /send for signature/i })).toBeEnabled();
  });

  it("keeps send disabled until a primary lease document exists", async () => {
    vi.mocked(getPrimaryLeaseDocument).mockResolvedValueOnce(null);
    render(<LeaseSigningDashboard leaseId="lease-1" tenantEmail="tenant@example.com" />);

    await waitFor(() => expect(screen.getByText(/no primary lease pdf generated yet/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /send for signature/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /generate primary lease pdf/i }));

    await waitFor(() => expect(generatePrimaryLeaseDocument).toHaveBeenCalledWith("lease-1"));
    await waitFor(() => expect(screen.getByRole("button", { name: /send for signature/i })).toBeEnabled());
    expect(screen.queryByText(/lease-documents/i)).not.toBeInTheDocument();
  });

  it("renders Form P readiness status without exposing internal document storage", async () => {
    render(<LeaseSigningDashboard leaseId="lease-1" tenantEmail="tenant@example.com" />);

    await waitFor(() => expect(screen.getByText(/form p readiness: incomplete/i)).toBeInTheDocument());
    expect(screen.getByText(/58% complete/i)).toBeInTheDocument();
    expect(screen.getByText(/missing required fields: occupants\/adult occupants\/children, term type, due day, and 3 more/i)).toBeInTheDocument();
    expect(screen.getByText(/view all missing form p fields/i)).toBeInTheDocument();
    expect(screen.getByText(/tenant service email/i)).toBeInTheDocument();
    expect(screen.getByText(/tenant email service consent/i)).toBeInTheDocument();
    expect(screen.getByText(/landlord email service consent/i)).toBeInTheDocument();
    expect(screen.queryByText(/lease-documents/i)).not.toBeInTheDocument();
  });

  it("renders jurisdiction unavailable state safely", async () => {
    vi.mocked(getPrimaryLeaseDocument).mockResolvedValueOnce(null);
    vi.mocked(generatePrimaryLeaseDocument).mockRejectedValueOnce({ body: { error: "jurisdiction_template_unavailable" } });
    render(<LeaseSigningDashboard leaseId="lease-1" tenantEmail="tenant@example.com" />);

    await waitFor(() => expect(screen.getByRole("button", { name: /generate primary lease pdf/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /generate primary lease pdf/i }));

    await waitFor(() => expect(screen.getByText("jurisdiction_template_unavailable")).toBeInTheDocument());
    expect(screen.queryByText(/storage.googleapis.com/i)).not.toBeInTheDocument();
  });

  it("shows real provider dispatch without mock no-email warning", async () => {
    vi.mocked(getLeaseSigningStatus).mockResolvedValueOnce({
      ...pendingStatus,
      signingProviderId: "dropbox_sign",
      providerDispatchMode: "sandbox",
      providerDispatchStatus: "accepted",
      providerDispatchMessage: "Dropbox Sign accepted the request in test mode.",
    });

    render(<LeaseSigningDashboard leaseId="lease-1" tenantEmail="tenant@example.com" />);

    await waitFor(() => expect(screen.getByText(/dropbox sign accepted the request in test mode/i)).toBeInTheDocument());
    expect(screen.queryByText(/no signature email was sent/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/raw-provider-request/i)).not.toBeInTheDocument();
  });

  it("renders failed signing state safely and allows retry", async () => {
    vi.mocked(getLeaseSigningStatus).mockResolvedValueOnce({
      ...notStartedStatus,
      signingStatus: "failed",
      derivedLeaseState: "failed",
      signingProviderId: "dropbox_sign",
      signingRequestId: "lsr_safe_ref",
      providerDispatchMode: "real",
      providerDispatchStatus: "failed",
      providerDispatchMessage: "Signing provider could not accept the request.",
    });

    render(<LeaseSigningDashboard leaseId="lease-1" tenantEmail="tenant@example.com" />);

    await waitFor(() => expect(screen.getByText(/status: failed/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /send for signature/i })).toBeEnabled();
    expect(screen.queryByText(/raw-provider-request/i)).not.toBeInTheDocument();
  });
});
