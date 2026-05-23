import { describe, expect, it, vi, beforeEach } from "vitest";
import { prepareTenantTrustExport, previewTenantTrustExport } from "./tenantTrustExports";

const tenantApiFetchMock = vi.hoisted(() => ({
  tenantApiFetch: vi.fn(),
}));

vi.mock("./tenantApiFetch", () => tenantApiFetchMock);

describe("tenantTrustExports API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenantApiFetchMock.tenantApiFetch.mockResolvedValue({
      ok: true,
      data: {
        exportId: "export-1",
        lifecycle: "prepared",
      },
    });
  });

  it("sends preview consent as a JSON object so the tenant API wrapper adds Content-Type", async () => {
    await previewTenantTrustExport({
      audience: "tenant_portability",
      purpose: "tenant_controlled_portability",
      expiresInDays: 14,
      consentAccepted: true,
    });

    expect(tenantApiFetchMock.tenantApiFetch).toHaveBeenCalledWith(
      "/tenant/trust-exports/preview",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({
          consentAccepted: true,
        }),
      })
    );
    expect(typeof tenantApiFetchMock.tenantApiFetch.mock.calls[0][1].body).toBe("object");
  });

  it("sends prepare consent as a JSON object so checked consent reaches the backend", async () => {
    await prepareTenantTrustExport({
      audience: "tenant_portability",
      purpose: "tenant_controlled_portability",
      expiresInDays: 14,
      consentAccepted: true,
    });

    expect(tenantApiFetchMock.tenantApiFetch).toHaveBeenCalledWith(
      "/tenant/trust-exports",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({
          consentAccepted: true,
        }),
      })
    );
    expect(JSON.stringify(tenantApiFetchMock.tenantApiFetch.mock.calls[0][1].body)).not.toContain("realActorId");
  });
});
