import { expect } from "vitest";

const unsafeResponseMarkers = [
  "secret",
  "token",
  "authorization",
  "storage.googleapis.com",
  "gs://",
  "privateTenantData",
  "internalNote",
  "providerPayload",
];

export function expectNoSensitiveMarkers(payload: unknown) {
  const text = JSON.stringify(payload);
  for (const marker of unsafeResponseMarkers) {
    expect(text).not.toContain(marker);
  }
}

export function expectErrorSafe(payload: unknown) {
  expect(payload).toEqual(
    expect.objectContaining({
      ok: false,
      error: expect.any(String),
    })
  );
  expectNoSensitiveMarkers(payload);
}

export function expectReadonlyAuditTrail(payload: any) {
  const items = Array.isArray(payload?.data) ? payload.data : [];
  expect(items.length).toBeGreaterThan(0);
  for (const item of items) {
    const events = Array.isArray(item?.auditTrail) ? item.auditTrail : [item];
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event).toEqual(
        expect.objectContaining({
          action: expect.any(String),
          occurredAt: expect.any(String),
        })
      );
    }
    expect(item).not.toHaveProperty("mutationEnabled");
    expect(item).not.toHaveProperty("deleteEnabled");
  }
}
