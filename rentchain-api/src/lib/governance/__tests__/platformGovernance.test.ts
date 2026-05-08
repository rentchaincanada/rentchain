import { describe, expect, it } from "vitest";
import {
  actorFromRequest,
  classifyExportSensitivity,
  redactIdentifierMap,
  sanitizeTelemetryProps,
} from "../platformGovernance";

describe("platformGovernance", () => {
  it("normalizes attributable actor context from requests", () => {
    expect(
      actorFromRequest({
        user: {
          id: "admin-1",
          actorRole: "admin",
          landlordId: "landlord-1",
        },
      })
    ).toEqual({
      actorId: "admin-1",
      actorRole: "admin",
      landlordId: "landlord-1",
    });
  });

  it("projects telemetry to metadata only and removes sensitive payload keys", () => {
    const projected = sanitizeTelemetryProps({
      exportType: "screening_report",
      renderingPath: "backend_pdfkit",
      nested: {
        documentText: "raw document body",
        accountNumber: "123456",
        safeStatus: "completed",
      },
      tenantEmail: "tenant@example.com",
    });

    expect(projected).toEqual({
      exportType: "screening_report",
      renderingPath: "backend_pdfkit",
      nested: {
        safeStatus: "completed",
      },
    });
    expect(JSON.stringify(projected)).not.toContain("tenant@example.com");
    expect(JSON.stringify(projected)).not.toContain("raw document body");
  });

  it("classifies high-risk document exports as restricted", () => {
    expect(classifyExportSensitivity("screening_report")).toBe("restricted");
    expect(classifyExportSensitivity("tenant_report")).toBe("restricted");
    expect(classifyExportSensitivity("unknown_export")).toBe("confidential");
  });

  it("redacts sensitive support identifiers while preserving ordinary scope ids", () => {
    expect(
      redactIdentifierMap({
        propertyId: "prop-1",
        checkoutSessionId: "cs_123456",
        screeningOrderId: "order-abcdef",
      })
    ).toEqual({
      propertyId: "prop-1",
      checkoutSessionId: "***3456",
      screeningOrderId: "***cdef",
    });
  });
});
