# Structured Logging Redaction v1

## Executive Summary

Structured logging redaction v1 introduces a small runtime foundation for privacy-aware diagnostics in RentChain. Logs are treated as projection surfaces: operationally useful metadata may be retained, but restricted, raw, provider, credential, debug, stack, and private payload fields must not be logged.

This mission does not replace all logging globally and does not introduce a large logging framework. It adds a reusable helper and migrates a small set of higher-risk telemetry and webhook logging paths.

## Logging Philosophy

RentChain logs should be:

- structured where practical
- deterministic
- metadata-oriented
- sensitivity-aware
- useful for operational support
- safe for future evidence, audit, and governance workflows

Logs should not become a secondary data export channel.

## Redaction Rules

The v1 helper suppresses restricted field groups such as:

- SIN/SSN/government identity fields
- bank, account, routing, transit, institution, IBAN, SWIFT, card, and CVV fields
- tokens, API keys, webhook secrets, passwords, and credentials
- raw/provider/report payloads
- raw CSV and ignored CSV column values
- stack traces
- route-source and debug payload metadata

Inline token-like values in strings are redacted where practical, including common bearer token, Stripe key, webhook secret, and query-style token patterns.

## Safe Operational Metadata

The helper preserves safe operational metadata such as:

- route
- requestId
- correlationId
- eventType
- landlordId and tenantId where operationally necessary as internal references
- status codes
- projection profile names
- export/evidence profile versions

## Migrated Surfaces

Targeted migrations in v1:

- telemetry route write-failure logging
- system observability fail-soft logging
- Stripe screening webhook diagnostics
- TransUnion webhook identity fallback diagnostics
- telemetry sanitization now shares the restricted logging key detection baseline

## What This Guarantees

Structured logging redaction v1 guarantees:

- a shared `sanitizeLogPayload` helper exists
- a shared `safeOperationalLog` helper exists
- a shared `safeErrorLog` helper exists
- restricted key detection is reusable and tested
- migrated log paths no longer write raw restricted payload keys
- Error stacks are not logged by the helper

## What This Does Not Guarantee Yet

This is not a repo-wide logging rewrite. Many legacy `console.*` calls remain and should be migrated incrementally by risk.

Not yet covered:

- all lease/payment route diagnostics
- all screening provider adapter diagnostics
- all billing/subscription diagnostics
- all admin/support diagnostics
- boot-time logs
- future external log drain policy

## Future Follow-Ups

Recommended follow-up missions:

1. `fix/high-risk-route-safe-logging-v1`
2. `test/console-log-redaction-regression-v1`
3. `fix/screening-provider-adapter-log-safety-v1`
4. `fix/payment-and-billing-log-safety-v1`
5. `docs/logging-retention-and-access-policy-v1`

## DO NOT IGNORE

- Do not log raw provider payloads.
- Do not log raw CSV values or ignored banking columns.
- Do not log payment credentials or processor secrets.
- Do not log stack traces into operational/evidence-facing diagnostics.
- Do not rely on frontend projection filtering for log safety.
- Future governance and agent-routing systems must consume redacted metadata, not raw diagnostic payloads.
