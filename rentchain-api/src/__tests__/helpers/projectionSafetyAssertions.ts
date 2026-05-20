import { expect } from "vitest";

const RESTRICTED_PROJECTION_KEY_PATTERNS = [
  /^(sin|ssn|cvv)$/i,
  /social.*insurance/i,
  /bank.*account/i,
  /account.*number/i,
  /routing.*number/i,
  /transit.*number/i,
  /institution.*number/i,
  /^iban$/i,
  /^swift$/i,
  /card.*number/i,
  /raw.*report/i,
  /raw.*payload/i,
  /provider.*payload/i,
  /webhook.*secret/i,
  /^api.*key$/i,
  /^token$/i,
  /password/i,
  /secret/i,
  /ignored.*csv.*columns/i,
  /raw.*csv/i,
  /internal.*debug/i,
  /^stack$/i,
  /route.*source/i,
];

const SAFE_NEGATIVE_CONTROL_KEYS = new Set([
  "rawproviderpayloadincluded",
  "rawsensitivepayloadstored",
  "providerpayloadincluded",
  "supportmetadataincluded",
]);

function normalizedKey(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

function keyIsRestricted(value: string) {
  const normalized = normalizedKey(value);
  if (SAFE_NEGATIVE_CONTROL_KEYS.has(normalized)) return false;
  return RESTRICTED_PROJECTION_KEY_PATTERNS.some((pattern) => pattern.test(normalized));
}

function collectRestrictedKeys(value: unknown, path = "$", findings: string[] = []) {
  if (!value || typeof value !== "object") return findings;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectRestrictedKeys(item, `${path}[${index}]`, findings));
    return findings;
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = `${path}.${key}`;
    if (keyIsRestricted(key)) findings.push(nextPath);
    collectRestrictedKeys(nested, nextPath, findings);
  }
  return findings;
}

export function expectNoRestrictedProjectionFields(payload: unknown) {
  expect(collectRestrictedKeys(payload)).toEqual([]);
}

export function expectPayloadDoesNotContainValues(payload: unknown, values: string[]) {
  const serialized = JSON.stringify(payload);
  for (const value of values) {
    expect(serialized).not.toContain(value);
  }
}
