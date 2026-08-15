import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import TenantIdentityPage from "./TenantIdentityPage";

const api = vi.hoisted(() => ({
  getTenantIdentityRequirement: vi.fn(),
  listTenantIdentityDocuments: vi.fn(),
  recordTenantIdentityConsent: vi.fn(),
  uploadTenantIdentityDocument: vi.fn(),
  getTenantIdentityDocumentAccess: vi.fn(),
  deleteTenantIdentityDocument: vi.fn(),
}));
vi.mock("../../api/tenantIdentityDocumentsApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/tenantIdentityDocumentsApi")>()),
  ...api,
}));

const requirement = {
  required: true,
  requirementStatus: "action_required",
  collectionStatus: "not_uploaded",
  verificationStatus: "not_started",
  activeDocumentCount: 0,
  consent: { purpose: "identity_document_collection", requirementPolicyId: "required-id", requirementPolicyVersion: "v1", policyTextVersion: "v1", privacyNoticeVersion: "v1", retentionPolicyVersion: "v1" },
  acceptedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  maxFileBytes: 10 * 1024 * 1024,
  applicationContinuity: true,
  tenantContinuity: true,
  biometricProcessing: false,
  pdfSupported: false,
} as const;

describe("TenantIdentityPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    api.getTenantIdentityRequirement.mockResolvedValue(requirement);
    api.listTenantIdentityDocuments.mockResolvedValue([]);
    api.recordTenantIdentityConsent.mockResolvedValue(undefined);
    api.uploadTenantIdentityDocument.mockResolvedValue({});
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:preview") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  });

  it("renders a mandatory image-only workflow without false verification", async () => {
    render(<MemoryRouter><TenantIdentityPage /></MemoryRouter>);
    expect(await screen.findByText("Government ID required")).toBeInTheDocument();
    expect(screen.getAllByText("Verification not started").length).toBeGreaterThan(0);
    expect(screen.getByText(/PDF is not supported/)).toBeInTheDocument();
    expect(screen.getByText(/No facial recognition/)).toBeInTheDocument();
    expect(screen.queryByText(/^Verified$/)).not.toBeInTheDocument();
  });

  it("blocks upload until explicit consent is checked", async () => {
    render(<MemoryRouter><TenantIdentityPage /></MemoryRouter>);
    await screen.findByText("Government ID required");
    const fileInput = screen.getByLabelText("Choose an existing image");
    fireEvent.change(fileInput, { target: { files: [new File(["image"], "id.png", { type: "image/png" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload government ID" }));
    expect(await screen.findByText(/Review and accept/)).toBeInTheDocument();
    expect(api.recordTenantIdentityConsent).not.toHaveBeenCalled();
  });

  it("records consent before uploading an accepted image", async () => {
    render(<MemoryRouter><TenantIdentityPage /></MemoryRouter>);
    await screen.findByText("Government ID required");
    fireEvent.change(screen.getByLabelText("Choose an existing image"), { target: { files: [new File(["image"], "id.png", { type: "image/png" })] } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Upload government ID" }));
    await waitFor(() => expect(api.uploadTenantIdentityDocument).toHaveBeenCalled());
    expect(api.recordTenantIdentityConsent.mock.invocationCallOrder[0]).toBeLessThan(api.uploadTenantIdentityDocument.mock.invocationCallOrder[0]);
  });
});
