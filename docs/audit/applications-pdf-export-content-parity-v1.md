# Applications PDF Export Content Parity Audit v1

## Status

- Mission: `audit/applications-pdf-export-content-parity-v1`
- Issue: Applications PDF/export content is less complete than the in-app Application Summary.
- Scope: docs/audit only.
- Recommended follow-up: `fix/applications-pdf-export-content-parity-v1`

## Observed Concern

Applications have rich in-app review surfaces, but the generated PDF/export path does not appear to carry the same review context. This creates a landlord workflow gap: the screen used for review contains more useful evidence and decision context than the document that can be printed, saved, or shared for internal review.

This audit found two separate export-like paths:

1. Applications page browser print/export from `/applications`.
2. Application Review Summary backend PDF from `/applications/:applicationId/review-summary`.

Both are narrower than the in-app review surfaces, but for different reasons.

## Source Files Reviewed

- `rentchain-frontend/src/pages/ApplicationsPage.tsx`
- `rentchain-frontend/src/components/applications/PrintApplicationView.tsx`
- `rentchain-frontend/src/components/applications/ApplicationDecisionSummaryCard.tsx`
- `rentchain-frontend/src/components/applications/LandlordDecisionPanel.tsx`
- `rentchain-frontend/src/pages/ApplicationReviewSummaryPage.tsx`
- `rentchain-frontend/src/api/reviewSummaryApi.ts`
- `rentchain-frontend/src/api/applicationsApi.ts`
- `rentchain-frontend/src/types/applications.ts`
- `rentchain-api/src/routes/rentalApplicationsRoutes.ts`
- `rentchain-api/src/lib/reviewSummary.ts`

## Current Export Paths

### Applications Page Print

`ApplicationsPage.tsx` uses `printSummaryDocument("application")` to print a hidden `PrintApplicationView`.

The printable object is derived from the selected application detail, but the transform maps only a limited subset of fields:

- applicant display name
- applicant email and phone
- applicant date of birth
- property name
- a legacy monthly income value
- the first residential history address
- selected references fields
- basic flags and notes

The print view is frontend browser print, not a backend-generated PDF.

### Review Summary PDF

`ApplicationReviewSummaryPage.tsx` can request a signed PDF URL from:

`GET /rental-applications/:id/review-summary.pdf`

The backend route uses `buildReviewSummaryPdf(summary)` from `rentchain-api/src/lib/reviewSummary.ts`. That PDF currently renders a deterministic core summary:

- applicant overview
- employment and income
- references and compliance
- deterministic screening/status signals
- insights

The route builds only the core review summary for the PDF. It does not pass the richer review-summary page additions such as decision summary, risk context, tenant credibility, portable identity, trust context, or network reuse summaries into the PDF builder.

## In-App Application Summary Content

The in-app application review surfaces include materially more context than the print/export outputs. Depending on available data, the in-app view can expose:

- applicant identity and contact information
- property and unit context
- application status and workflow state
- applicant profile details
- current housing and active lease context
- residential history
- employment and income
- income-to-rent context
- references
- co-applicant or additional applicant details
- household context
- consent and compliance details
- screening workflow status
- screening result summaries
- risk score, grade, and decision guidance
- risk factors, flags, and recommendations
- reference questions and decision support
- viewing requests and selected/proposed slots
- landlord notes and flags
- timeline or recent activity context
- lease preparation and decision follow-through context on the review-summary route

## Current Parity Gaps

| Section | In-app summary | Applications page print | Review summary PDF |
| --- | --- | --- | --- |
| Applicant identity/contact | Present | Partial | Present |
| Application status/workflow | Present | Partial | Limited |
| Property/unit context | Present | Property name only; unit is not mapped | Missing or limited |
| Household/occupants | Present when data exists | Missing | Missing |
| Co-applicant/additional applicants | Present when data exists | Only if already available in legacy `applicants` shape | Missing |
| Employment/income | Present with richer profile context | Partial legacy mapping | Present in core form |
| Residential history | Present | First address only | Current address only |
| Current housing/lease conflict | Present | Missing | Missing |
| References | Present | Partial | Present in core form |
| Consent/compliance | Present | Missing or minimal | Present in core form |
| Viewing requests | Present | Missing | Missing |
| Screening/risk summary | Present | Missing | Screening basics only |
| Decision guidance | Present | Missing | Missing |
| Risk factors/flags/recommendations | Present | Flags only | Limited deterministic insights |
| Notes | Present | Partial | Missing |
| Timeline/recent activity | Present | Missing | Missing |
| Review/decision context | Present | Missing | Missing |

## Safety And Privacy Findings

The export should remain landlord-only and authorization-protected.

The export should not expose raw internal identifiers as user-facing labels. The backend PDF currently prints `Application ID: ${summary.applicationId}`. If that value is a raw internal application ID, the follow-up should replace it with a landlord-safe display reference or omit it.

The export should avoid:

- raw Firestore document IDs
- landlord IDs
- tenant IDs
- property IDs
- unit IDs
- screening provider payloads
- provider order IDs unless explicitly redacted and already landlord-safe
- storage paths
- tokens or signed URL internals
- broad raw screening reports

Screening and risk sections should use curated landlord-safe summaries, not raw provider data. Schedule, viewing, and decision data should be summarized in business language rather than exported as internal workflow records.

## Root Cause Classification

This is primarily a content-contract gap.

The Applications page print path is a lightweight browser-print component with a narrow data mapping. It was not built as a parity export for the full Application Summary.

The backend Review Summary PDF is more structured, but its route sends only the core deterministic summary into the PDF builder. The in-app review route has richer decision, risk, trust, and workflow data that is not included in the PDF model.

There is also a source-of-truth mismatch: Applications page print and Review Summary PDF are separate implementations with different data models. That makes parity difficult to maintain.

## Recommended Export Contract

The follow-up should define a curated Application Review Export model that is shared by the export routes and, where practical, the print preview.

Recommended sections:

1. Applicant identity and contact
2. Application status and submitted/review timestamps
3. Property, unit, rent, and move-in context using display labels
4. Household, co-applicant, occupants, pets, and vehicles where applicable
5. Employment, income, and income-to-rent context
6. Residential history
7. References
8. Consent and compliance
9. Screening summary and risk snapshot using landlord-safe summaries
10. Viewing request summary
11. Landlord notes, flags, and decision guidance
12. Review timeline or recent activity summary
13. Decision and lease-preparation context where appropriate

The export should be evidence-grade enough for landlord review, but not a raw audit dump. Internal audit records can remain in internal tools unless explicitly needed and safely projected.

## Implementation Recommendation

Implement `fix/applications-pdf-export-content-parity-v1`.

Recommended approach:

- Treat the backend Review Summary PDF as the durable export path.
- Extend the review summary export model to include curated parity sections from the in-app Application Summary.
- Update the PDF builder to render the expanded contract with readable multi-page output.
- Remove or replace raw internal IDs in exported content.
- Update the Applications page print/export action to use the same export contract where practical, or route users to the Review Summary PDF export when that is the canonical landlord export.
- Keep browser print as a convenience only if it can be aligned with the same content contract.

Avoid directly cloning interactive UI components into the PDF. The export needs stable, printable sections, not controls, hidden panels, provider payloads, or screen-only affordances.

## Future Acceptance Criteria

- Applications export includes applicant identity/contact.
- Export includes application status and submitted/review context.
- Export includes landlord-safe property/unit/rent/move-in context.
- Export includes household/co-applicant context when present.
- Export includes employment, income, residential history, and references.
- Export includes consent/compliance summary.
- Export includes landlord-safe screening/risk/decision guidance.
- Export includes viewing request summary when present.
- Export includes notes/flags where appropriate.
- Export does not expose raw internal IDs or provider payloads.
- Export is landlord-only and authorization-protected.
- Export output remains readable across multiple pages.
- Applications page export and Review Summary PDF do not diverge on core content.

## Future Test Coverage

Recommended tests for the implementation PR:

- Backend PDF builder test proving each required export section renders when data exists.
- Backend route test for `/rental-applications/:id/review-summary.pdf` proving expanded summary data reaches the PDF builder.
- Privacy test proving raw internal IDs, storage paths, and provider payload keys are not rendered.
- Frontend Applications page test proving the export action uses the canonical export path or a parity print model.
- Review Summary page test proving PDF export remains available to authorized landlords.
- Fixture coverage for applications with co-applicant, household, viewing request, screening/risk, and notes data.

## Audit Validation

- Docs-only change expected.
- No frontend, backend, runtime, schema, or export behavior changes in this audit.
- Required validation:
  - `git diff --check`
  - competitor-name scan
  - docs-only diff confirmation
  - working tree clean after publish
