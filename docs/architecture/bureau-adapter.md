# Bureau Adapter Architecture

## Scope
- Provide a provider-agnostic adapter layer for credit bureaus.
- Initial providers in scope: TransUnion and Equifax.
- Keep the application workflow stable by mapping provider-specific payloads into one internal contract.

## Adapter Interfaces
```ts
export type BureauProvider = "transunion" | "equifax";

export type BureauConsentRecord = {
  consentId: string;
  applicationId: string;
  tenantId?: string;
  acceptedAtIso: string;
  consentVersion: string;
  ipHash?: string;
  userAgentHash?: string;
};

export type BureauInquiryRequest = {
  provider: BureauProvider;
  applicationId: string;
  landlordId: string;
  tenantId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  dateOfBirth?: string;
  currentAddressLine1?: string;
  currentCity?: string;
  currentProvince?: string;
  currentPostalCode?: string;
  consent: BureauConsentRecord;
  correlationId: string;
};

export type BureauInquiryStatus =
  | "created"
  | "submitted"
  | "processing"
  | "completed"
  | "failed"
  | "timeout";

export type BureauInquiryResult = {
  provider: BureauProvider;
  inquiryId: string;
  applicationId: string;
  status: BureauInquiryStatus;
  pulledAtIso?: string;
  scoreBand?: "A" | "B" | "C" | "D" | "E" | "unknown";
  summaryFlags?: string[];
  rawReportRef?: string;
  correlationId: string;
};

export type BureauAdapter = {
  submitInquiry(input: BureauInquiryRequest): Promise<BureauInquiryResult>;
  getInquiry(providerInquiryId: string, correlationId: string): Promise<BureauInquiryResult>;
  mapProviderWebhook(payload: unknown, correlationId: string): Promise<BureauInquiryResult>;
};
```

## Timeline Event Mapping
- Each bureau state transition should emit a normalized timeline event:
  - `SCREENING` + `Screening requested` when inquiry is created/submitted.
  - `SCREENING` + `Screening in progress` when provider status is processing.
  - `SCREENING` + `Screening completed` when provider returns final result.
  - `SCREENING` + `Screening failed` for hard failures/timeouts.
- Event shape target:
  - `type`: `SCREENING`
  - `occurredAt`: provider timestamp or server receipt timestamp
  - `entity.applicationId`: required
  - `entity.tenantId`: optional
  - `metadata.source`: `bureauAdapter`
  - `metadata.provider`: `transunion` or `equifax`
  - `metadata.status`: normalized status above
  - `metadata.correlationId`: required for traceability

## Consent Checklist
- Consent must be explicit before any inquiry submission.
- Track and persist:
  - consent version text hash
  - accepted timestamp (ISO)
  - application id
  - tenant id (when available)
  - hashed request context fields (IP/User-Agent)
- Block inquiry if consent record is missing or stale.
- Ensure consent copy states bureau provider use and screening purpose.

## Retention Checklist
- Store only required screening artifacts for operational and compliance needs.
- Separate:
  - normalized screening summary (application-level)
  - raw report reference pointer (restricted access)
- Retention defaults:
  - screening summaries: policy-defined timeline retention
  - raw reports: restricted lifecycle with explicit delete/archive workflow
  - consent records: retained per compliance minimum window
- Log access to raw report references in audit trail.
- Ensure exports do not include raw report contents by default.
