PR: #1120
PR URL: https://github.com/rentchaincanada/rentchain/pull/1120
Branch: fix/viewing-request-tenant-notification-v1

# Implementation Summary

## Mission
Tenant Viewing Time Confirmation Notification.

## Files Changed
- `rentchain-api/src/services/viewings/viewingService.ts`
- `rentchain-api/src/routes/__tests__/viewingRoutes.test.ts`

## What Changed
- Added tenant-facing viewing confirmation email delivery after a landlord-selected slot is successfully persisted.
- Resolved the recipient only from `ViewingRequestDoc.applicantEmail` and skipped notification when the value is missing or fails email format validation.
- Built email content through the existing base email template helpers and existing `sendEmail` infrastructure.
- Included readable UTC viewing date and time, safe label-based property/unit context, and slot notes when present.
- Avoided raw property or unit ID fallback in tenant-facing email content by using generic location text when labels are unavailable.
- Kept email delivery failures non-blocking so viewing scheduling still succeeds after persistence.

## Governance
- Scope limited to backend viewing service notification behavior and viewing route tests.
- No auth, route, Firestore rules, billing, screening, pricing, deployment, dependency, frontend, or data model changes.
- Viewing slot selection remains landlord-only through the existing route guard.
- Notification is additive only and does not alter the viewing request document shape.
- Tenant-facing email content avoids raw IDs, tokens, storage paths, provider payloads, or debug details.

## Validation
- `npm --prefix rentchain-api run test -- src/routes/__tests__/viewingRoutes.test.ts`: PASS, 14 tests.
- `npm --prefix rentchain-api run build`: PASS.
- `git diff --check`: PASS.

## Manual QA
- Manual browser/email QA not completed locally.
- Full manual QA requires seeded viewing request data, landlord preview access, and configured email provider credentials.
- Automated tests verify the mission-critical notification behavior, skip behavior, failure handling, and invalid selection behavior.

## Known Limitations
- Datetime rendering uses deterministic UTC text and does not add complex timezone preference handling.
- Email delivery depends on configured provider environment variables.
- The notification link uses the existing viewing email link pattern.

## Recommended Follow-Up
- Run preview manual QA with seeded viewing requests and a configured email provider.
- Confirm actual email delivery to a test applicant address after selecting a proposed viewing slot.
