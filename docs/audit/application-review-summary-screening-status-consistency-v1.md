# Application Review Summary Screening Status Consistency Audit v1

## Status

- Mission: `audit/application-review-summary-screening-status-consistency-v1`
- Scope: docs/audit only.
- Primary fixture: `/applications/ixcRcv8tTgz0lKvDRw66/review-summary`
- Recommended follow-up: `fix/application-review-summary-status-aware-guidance-v1`

## Executive Summary

The observed state, `APPROVED` application status with `Screening status: not_requested`, can be technically valid. An application can be approved from deterministic application signals, references, landlord review, or other manual workflow evidence without a completed third-party screening package.

The product problem is presentation consistency. The Application Review Summary currently renders screening and decision fields as independent raw-ish facts. For an approved application, the summary can still show screening-oriented decision guidance such as `Complete screening before deciding.` because the decision-support builder does not branch on final application status before producing next-action copy.

This is not proven to be a screening workflow calculation bug. The safest follow-up is a narrow status-aware summary and label-normalization fix for the browser Review Summary and backend PDF export.

## Current Observed Behavior

During post-deploy QA for #1310, the Application Review Summary showed:

- Application status: `APPROVED`
- Screening status: `not_requested`
- Screening provider: `STUB`
- Decision/risk guidance may imply screening should be completed before deciding.

This reads awkwardly in an RC1 demo because the summary can appear to tell the landlord that a final approved decision exists while also prompting a pre-decision screening step.

## Routes And Fixtures Reviewed

- `/applications/:applicationId/review-summary`
- `/rental-applications/:id/review-summary`
- `/rental-applications/:id/review-summary.pdf`
- Primary QA fixture: `ixcRcv8tTgz0lKvDRw66`

## Source Files Reviewed

- `rentchain-api/src/lib/reviewSummary.ts`
- `rentchain-api/src/services/risk/applicationDecisionSummary.ts`
- `rentchain-api/src/routes/rentalApplicationsRoutes.ts`
- `rentchain-api/src/lib/__tests__/reviewSummary.test.ts`
- `rentchain-api/src/services/__tests__/applicationDecisionSummary.test.ts`
- `rentchain-frontend/src/api/reviewSummaryApi.ts`
- `rentchain-frontend/src/pages/ApplicationReviewSummaryPage.tsx`
- `rentchain-frontend/src/components/applications/ApplicationDecisionSummaryCard.tsx`

## Browser Vs PDF Comparison

The browser page and PDF use the same backend summary sources:

- Browser JSON route builds `summary` with `buildReviewSummary(...)` and `decisionSummary` with `buildApplicationDecisionSummary(...)`.
- PDF route builds the same `summary` and `decisionSummary`, then renders `buildReviewSummaryPdf(...)`.

The browser Screening tab renders:

- `summary.screening.status || "not_run"`
- `summary.screening.provider || "Not provided"`

The PDF `Screening & Deterministic Signals` section renders:

- `summary.screening.status || "not_run"`
- `summary.screening.provider || "Not provided"`
- `decision.screeningRecommendation.reason`
- `decision.decisionSupport.nextBestAction`

There is no meaningful data-source drift between browser and PDF for this issue. Both surfaces can expose the same raw status/provider labels and the same status-agnostic guidance.

## Current Source-Of-Truth Mapping

| Field | Current source | Current behavior |
| --- | --- | --- |
| Application status | `application.status` through `buildReviewSummary` and `buildApplicationDecisionSummary` | Rendered as the raw or near-raw status string, such as `APPROVED`. |
| Screening status | `application.screeningStatus || application.screening.status` | Lowercased by `screeningStatus(...)`; values such as `not_requested` can render directly. |
| Screening provider | `application.screeningProvider || application.screening.provider` | Rendered directly when present; `STUB` can appear. |
| Screening recommendation | `buildScreeningRecommendation(...)` | Based on screening state, completeness, income/risk, and grade, not final application status. |
| Decision next action | `buildDecisionSupport(...)` | Can say `Complete screening before deciding.` when screening is recommended, regardless of application final status. |

## Status And Screening Matrix

| Application status | Screening status | Current interpretation | Landlord-facing recommendation |
| --- | --- | --- | --- |
| `SUBMITTED` | `not_requested` | Pending application without screening. | It is acceptable to recommend screening or references before deciding. |
| `SUBMITTED` | `completed` | Pending application with screening available. | Say screening is available and should be reviewed with references. |
| `APPROVED` | `not_requested` | Approved without third-party screening. | Do not prompt `before deciding`; summarize that approval was made without third-party screening. |
| `APPROVED` | `completed` | Approved with screening evidence. | Summarize that screening was available at decision time. |
| `DENIED` | `not_requested` | Denied without third-party screening. | Do not prompt a pending decision; summarize that no third-party screening was completed. |
| `DENIED` | `completed` | Denied with screening evidence. | Summarize that screening was part of the reviewed context where applicable. |
| `REVIEW_REQUIRED` | `not_requested` | Active review state without screening. | It is acceptable to recommend screening if risk/completeness warrants it. |
| `REVIEW_REQUIRED` | `completed` | Active review state with screening. | Recommend reviewing screening and references before recording final action. |

## Risk And Decision Guidance Findings

`buildApplicationDecisionSummary(...)` returns the application status, but `buildDecisionSupport(...)` does not receive or use application status. Its guidance is based on screening availability, screening recommendation, risk score, and completeness.

Current behavior is appropriate for pending/review states, but it is not status-aware for final states:

- Approved applications should not be told to complete screening before deciding.
- Denied applications should not be told to complete screening before deciding.
- Final-state summaries should use retrospective copy: what happened, what evidence was available, and what context was missing.
- Pending/review-state summaries can continue using prospective next-action copy.

This is a copy/summary logic issue, not a proven status transition bug.

## Raw/Internal Label Exposure Findings

The summary currently normalizes some dangerous identifier fields, but screening labels remain too raw for landlord-facing summaries.

Findings:

- `not_requested` is technically understandable to engineers, but it should render as landlord-facing copy such as `Screening not requested` or `No third-party screening completed`.
- `STUB` appears to be a provider/test implementation detail and should not render as a landlord-facing provider label.
- `complete` and `completed` should probably normalize to one display label, such as `Screening complete`.
- `paid`, `processing`, `external_pending`, and `unpaid` should be reviewed for display-label consistency if they can appear in review summaries.
- Provider labels should either use a curated display map or fall back to `Not provided` / `Configured screening provider`, not raw internal adapter names.

The current test coverage already protects against raw application IDs and raw screening references in the PDF. It does not yet cover display normalization for screening status/provider labels.

## Is This Data-State Or Copy?

Classification: primarily copy/status-aware summary behavior.

`APPROVED` + `not_requested` is a valid state if the landlord approved without requesting or completing third-party screening. The summary should make that explicit instead of implying the application is still waiting for pre-decision screening.

No audit evidence proves that application status or screening status is stale. A data-state follow-up would only be warranted if production records show a completed screening result/order that is not reflected in `screeningStatus`, or if approval was automatically recorded despite a policy requirement for screening.

## Recommended Follow-Up

Implement `fix/application-review-summary-status-aware-guidance-v1`.

The follow-up should be narrow and should not change screening workflow state, application decision state, or screening automation.

Recommended implementation:

- Add landlord-facing screening status display labels for browser/PDF output.
- Add landlord-facing provider display labels that hide implementation details such as `STUB`.
- Make `buildDecisionSupport(...)` or a wrapper status-aware.
- For final statuses such as `APPROVED` and `DENIED`, use retrospective copy rather than pre-decision next actions.
- Preserve current prospective guidance for `SUBMITTED` and `REVIEW_REQUIRED`.
- Add tests for final-state applications with `not_requested` screening.

## Future Acceptance Criteria

- `APPROVED` + `not_requested` does not show `Complete screening before deciding.`
- `APPROVED` + `not_requested` explains that no third-party screening was completed/requested for the decision.
- `DENIED` + `not_requested` does not imply the decision is still pending.
- `SUBMITTED` + `not_requested` can still recommend completing screening before deciding when risk/completeness warrants it.
- Browser Review Summary and downloaded PDF use the same landlord-facing screening labels.
- `not_requested` does not render as a raw enum in landlord-facing summary sections.
- `STUB` does not render as a landlord-facing provider label.
- Raw screening references, provider order IDs, application IDs, property IDs, and unit IDs remain hidden.
- Existing Application Context hydration from #1310 remains intact.
- Existing `Back to applications` and `Download PDF` actions remain intact.

## Future Manual QA Checklist

1. Open `/applications/:applicationId/review-summary` for an approved application with no completed screening.
2. Confirm the summary explains that third-party screening was not completed/requested.
3. Confirm no pre-decision action such as `Complete screening before deciding` appears for approved/denied final states.
4. Confirm `STUB` is not visible as a provider label.
5. Download the PDF and confirm the same labels/copy appear there.
6. Confirm a submitted/review-required application can still show prospective screening guidance.
7. Confirm no raw internal/provider IDs are exposed.
8. Regression check:
   - `/applications`
   - `/dashboard`
   - `/leases`
   - `/analytics`

## Validation For This Audit

- Docs-only change.
- No frontend, backend, screening, decision, PDF, or route behavior changes.
- Required validation:
  - `git diff --check`
  - `git diff --cached --check`
  - competitor-name scan
  - docs-only diff confirmation
  - working tree clean after publish
