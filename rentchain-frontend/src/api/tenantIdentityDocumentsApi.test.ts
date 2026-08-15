import { beforeEach, describe, expect, it, vi } from "vitest";

import { getTenantIdentityRequirement, recordTenantIdentityConsent, uploadTenantIdentityDocument } from "./tenantIdentityDocumentsApi";

const mocks = vi.hoisted(() => ({ tenantApiFetch: vi.fn() }));
vi.mock("./tenantApiFetch", () => mocks);

describe("tenant identity documents API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tenantApiFetch.mockResolvedValue({ ok: true, data: {} });
  });

  it("loads the canonical tenant requirement without a client-selected subject", async () => {
    await getTenantIdentityRequirement();
    expect(mocks.tenantApiFetch).toHaveBeenCalledWith("/tenant/identity-documents/status", {});
    expect(JSON.stringify(mocks.tenantApiFetch.mock.calls)).not.toContain("subjectId");
  });

  it("records explicit collection consent", async () => {
    await recordTenantIdentityConsent("en-CA");
    expect(mocks.tenantApiFetch).toHaveBeenCalledWith("/tenant/identity-documents/consent", {
      method: "POST",
      body: { acknowledged: true, displayedLocale: "en-CA" },
    });
  });

  it("uploads image metadata as multipart without authority overrides", async () => {
    const file = new File(["image"], "id.png", { type: "image/png" });
    await uploadTenantIdentityDocument({ file, documentType: "passport", side: "photo_page", issuingCountry: "CA" });
    const [, init] = mocks.tenantApiFetch.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.body.get("file")).toBe(file);
    expect(init.body.get("subjectId")).toBeNull();
    expect(init.body.get("tenantId")).toBeNull();
  });
});
