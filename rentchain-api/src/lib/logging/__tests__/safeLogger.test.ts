import { afterEach, describe, expect, it, vi } from "vitest";

import {
  expectNoRestrictedProjectionFields,
  expectPayloadDoesNotContainValues,
} from "../../../__tests__/helpers/projectionSafetyAssertions";
import {
  isRestrictedLogKey,
  redactLogString,
  safeErrorLog,
  safeOperationalLog,
  sanitizeLogPayload,
} from "../safeLogger";

describe("safeLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deterministically removes restricted field groups while preserving safe operational metadata", () => {
    const sanitized = sanitizeLogPayload({
      route: "/api/ledger/imports/payment-csv/confirm",
      requestId: "req-1",
      correlationId: "corr-1",
      eventType: "payment_import_confirm_failed",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      statusCode: 500,
      projectionProfile: "tenant_safe_workspace_projection",
      exportVersion: "institutional_export_v1",
      rawPayload: { providerPayload: "raw provider dump" },
      rawCsv: "bank csv contents",
      ignoredCsvColumns: ["Bank Account"],
      bankAccount: "111122223333",
      accountNumber: "444455556666",
      routingNumber: "000111222",
      token: "secret-token",
      apiKey: "sk_live_sensitive",
      webhookSecret: "whsec_sensitive",
      stack: "private stack trace",
      routeSource: "debug router",
      debugPayload: { internalDebug: "debug details" },
    });

    expect(sanitized).toEqual({
      route: "/api/ledger/imports/payment-csv/confirm",
      requestId: "req-1",
      correlationId: "corr-1",
      eventType: "payment_import_confirm_failed",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      statusCode: 500,
      projectionProfile: "tenant_safe_workspace_projection",
      exportVersion: "institutional_export_v1",
    });
    expectNoRestrictedProjectionFields(sanitized);
    expectPayloadDoesNotContainValues(sanitized, [
      "raw provider dump",
      "bank csv contents",
      "111122223333",
      "444455556666",
      "000111222",
      "secret-token",
      "sk_live_sensitive",
      "whsec_sensitive",
      "private stack trace",
      "debug router",
      "debug details",
    ]);
  });

  it("redacts inline secrets from string messages and Error objects without logging stacks", () => {
    const error = new Error("provider failed with token=abc123 and whsec_secret");
    error.stack = "private stack trace with sk_live_secret";

    const sanitized = sanitizeLogPayload({
      message: "Authorization: Bearer eyJsecret.jwt",
      error,
    });

    expect(sanitized).toEqual({
      message: "Authorization: [REDACTED]",
      error: {
        name: "Error",
        message: "provider failed with token=[REDACTED] and [REDACTED]",
      },
    });
    expectPayloadDoesNotContainValues(sanitized, ["abc123", "whsec_secret", "private stack trace", "sk_live_secret"]);
  });

  it("uses sanitized payloads for operational and error console helpers", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    safeOperationalLog("warn", "[test] raw webhook warning token=abc123", {
      route: "/api/stripe/webhook",
      providerPayload: "raw provider dump",
      routeSource: "internal router",
      safeStatus: "blocked",
    });
    safeErrorLog("[test] provider failure", new Error("failed with sk_test_secret"), {
      screeningOrderId: "order-1",
      stack: "private stack trace",
    });

    expect(warnSpy).toHaveBeenCalledWith("[test] raw webhook warning token=[REDACTED]", {
      route: "/api/stripe/webhook",
      safeStatus: "blocked",
    });
    expect(errorSpy).toHaveBeenCalledWith("[test] provider failure", {
      screeningOrderId: "order-1",
      error: {
        name: "Error",
        message: "failed with [REDACTED]",
      },
    });
  });

  it("keeps restricted-key detection explicit for future logging migrations", () => {
    expect(isRestrictedLogKey("providerPayload")).toBe(true);
    expect(isRestrictedLogKey("rawCsv")).toBe(true);
    expect(isRestrictedLogKey("routeSource")).toBe(true);
    expect(isRestrictedLogKey("requestId")).toBe(false);
  });

  it("redacts common inline token formats deterministically", () => {
    expect(redactLogString("token=abc123 api_key=key123 whsec_secret sk_test_secret")).toBe(
      "token=[REDACTED] api_key=[REDACTED] [REDACTED] [REDACTED]",
    );
  });
});
