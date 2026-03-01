# Bureau Adapter Specification v1

Related docs:
- [Bureau Capability Matrix](./bureau-capability-matrix.md)
- [Bureau Event Mapping](./bureau-event-mapping.md)

## Purpose

Define a provider-agnostic adapter contract for bureau integrations. The same contract must support current TransUnion integration and future Equifax integration without changing product workflow interfaces.

## Design Constraints

- Provider-specific details stay in provider modules.
- Product workflows consume only normalized request/response types.
- Consent and authorization checks happen before provider calls.
- No delivery timeline commitments are made in this specification.

## Core Interfaces (TypeScript-style)

```ts
export type BureauProvider = "transunion" | "equifax" | "manual";

export type ScreeningRequest = {
  requestId: string;
  landlordId: string;
  tenantId: string;
  applicationId?: string;
  consentId: string;
  purpose: "tenant_screening";
  subject: {
    firstName: string;
    lastName: string;
    email?: string;
    dateOfBirth?: string; // YYYY-MM-DD
    address?: {
      line1?: string;
      city?: string;
      province?: string;
      postalCode?: string;
      country?: string;
    };
  };
  metadata?: Record<string, unknown>;
};

export type NormalizedScreeningStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "requires_action"
  | "cancelled";

export type ScreeningOutcome = "pass" | "review" | "fail" | "unknown";

export type ScreeningResult = {
  screeningId: string;
  provider: BureauProvider;
  status: NormalizedScreeningStatus;
  outcome: ScreeningOutcome;
  scoreBand?: "low" | "medium" | "high";
  reportReference?: string; // provider-safe identifier
  completedAt?: string; // ISO-8601
  rawReferenceId?: string; // provider trace id, never a secret
  metadata?: Record<string, unknown>;
};

export type BureauAdapterErrorCode =
  | "provider_unavailable"
  | "provider_timeout"
  | "consent_required"
  | "invalid_request"
  | "rate_limited"
  | "unauthorized"
  | "not_found"
  | "unknown";

export type BureauAdapterError = {
  code: BureauAdapterErrorCode;
  message: string;
  retryable: boolean;
  correlationId?: string;
  provider?: BureauProvider;
};

export type BureauAdapterResponse =
  | { ok: true; result: ScreeningResult }
  | { ok: false; error: BureauAdapterError };

export interface BureauAdapter {
  provider: BureauProvider;
  submitScreening(input: ScreeningRequest): Promise<BureauAdapterResponse>;
  getScreening(screeningId: string): Promise<BureauAdapterResponse>;
  cancelScreening?(screeningId: string): Promise<BureauAdapterResponse>;
}
```

## Compliance Boundaries

- Adapter layer does not bypass consent gates.
- Adapter layer does not decide tenancy outcomes.
- Provider credentials remain server-side only.
- Logs use correlation identifiers; no secrets or raw authorization tokens.

