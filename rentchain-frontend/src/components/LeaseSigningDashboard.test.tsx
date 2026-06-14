import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LeaseSigningDashboard from "./LeaseSigningDashboard";
import {
  getLeaseSigningStatus,
  sendLeaseForSignature,
  type LeaseSigningStatusResponse,
} from "../api/leasesApi";

vi.mock("../api/leasesApi", () => ({
  cancelLeaseSigning: vi.fn(),
  downloadSignedLease: vi.fn(),
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

describe("LeaseSigningDashboard", () => {
  beforeEach(() => {
    vi.mocked(getLeaseSigningStatus).mockResolvedValue(notStartedStatus);
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

    fireEvent.click(screen.getByRole("button", { name: /send for signature/i }));

    await waitFor(() => expect(screen.getByText("invalid_tenant_email")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /send for signature/i })).toBeEnabled();
  });
});
