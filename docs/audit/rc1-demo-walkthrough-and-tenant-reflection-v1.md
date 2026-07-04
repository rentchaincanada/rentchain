# RC1 Demo Walkthrough and Tenant Reflection Audit v1

Date: 2026-07-04
Mission: `audit/rc1-demo-walkthrough-and-tenant-reflection-v1`
Related sequence: PRs #1287 through #1296
Latest related merge: `b1992477b697df5022904e3a15f1e95fc2edce0f`

## Scope

This is a docs-only audit of the RC1 landlord demo path and the tenant-facing reflection of landlord-side application, lease, signing, payment, document, inbox, export, and analytics activity.

No frontend, backend, route, schema, payment, signing, tenant portal, export, or data-model implementation changed in this audit.

## Executive Summary

The RC1 landlord demo path is now materially stronger than it was before the recent polish and state-integrity sequence. The landlord-facing path from Dashboard to Operations, Applications, lease setup, payment readiness, lease ledger, unified inbox, and analytics is coherent enough for a guided demo. The highest-risk previously observed contradictions are also substantially addressed:

- Provider-signed leases no longer need to render tenant copy such as `Signature workflow not started` when signing is complete.
- Signed-copy-pending state is explicit when provider signing is complete but no tenant-safe signed document link is available.
- Rent collection setup distinguishes `Review rent terms`, `ready_to_configure`, and enabled payment rails.
- Tenant payment surfaces avoid offering checkout before landlord-side rent collection is enabled.
- Application and lease-ledger exports now include meaningful content and avoid raw internal IDs in the validated paths.
- Unified inbox read state persists after the deployed #1293 backend.

The main remaining gap is not a single obvious UI contradiction. It is end-to-end proof: the product needs a deterministic RC1 demo fixture or walkthrough test that exercises one complete landlord-to-tenant state transition and verifies the tenant portal reflects it across profile, lease, payments, documents, and messages. Recent source and manual QA evidence covers the individual surfaces, but not one fully traceable demo record from application conversion through tenant reflection.

## Demo Path Reviewed

Primary landlord route path reviewed:

1. `/dashboard`
2. `/operations`
3. `/applications`
4. Application summary and landlord decision panel
5. Application browser Print / Save PDF
6. `/applications/:applicationId/review-summary`
7. Application Review Summary backend PDF
8. Application/occupied-unit conversion to lease where applicable
9. `/leases`
10. `/leases/:leaseId/summary`
11. `/leases/:leaseId/summary?section=rent-payment`
12. `/leases/:leaseId/ledger`
13. Lease ledger Print / Save PDF
14. `/landlord/unified-inbox`
15. `/analytics?entry=revenue-pressure`
16. `/analytics?entry=vacancy-readiness`

Tenant route path reviewed:

1. `/tenant/dashboard`
2. `/tenant/profile`
3. `/tenant/lease`
4. `/tenant/payments`
5. `/tenant/attachments`
6. `/tenant/documents`
7. `/tenant/messages`

Audit basis:

- Current source review on `main` after #1296.
- Accepted manual QA results from PRs #1287 through #1296.
- Post-deploy validation notes for #1293 and #1296.
- No new authenticated browser data mutation was performed by this audit.

## Source Files Reviewed

Frontend:

- `rentchain-frontend/src/App.tsx`
- `rentchain-frontend/src/components/layout/navConfig.ts`
- `rentchain-frontend/src/pages/DashboardPage.tsx`
- `rentchain-frontend/src/pages/OperationalCommandCenterPage.tsx`
- `rentchain-frontend/src/pages/ApplicationsPage.tsx`
- `rentchain-frontend/src/components/applications/LandlordDecisionPanel.tsx`
- `rentchain-frontend/src/components/applications/PrintApplicationView.tsx`
- `rentchain-frontend/src/pages/ApplicationReviewSummaryPage.tsx`
- `rentchain-frontend/src/pages/LandlordActiveLeasesPage.tsx`
- `rentchain-frontend/src/pages/LandlordLeaseSummaryPage.tsx`
- `rentchain-frontend/src/pages/LeaseLedgerPage.tsx`
- `rentchain-frontend/src/pages/UnifiedInboxPage.tsx`
- `rentchain-frontend/src/pages/landlord/LandlordAnalyticsPage.tsx`
- `rentchain-frontend/src/pages/tenant/TenantWorkspacePage.tsx`
- `rentchain-frontend/src/pages/tenant/TenantProfilePage.tsx`
- `rentchain-frontend/src/pages/tenant/TenantLeasePage.tsx`
- `rentchain-frontend/src/pages/tenant/TenantPaymentsPage.tsx`
- `rentchain-frontend/src/pages/tenant/TenantAttachmentsPage.tsx`
- `rentchain-frontend/src/api/tenantPortal.ts`
- `rentchain-frontend/src/api/unifiedInboxApi.ts`

Backend:

- `rentchain-api/src/routes/tenantPortalRoutes.ts`
- `rentchain-api/src/services/tenantPortal/tenantProjectionService.ts`
- `rentchain-api/src/services/applicationConversionService.ts`
- `rentchain-api/src/routes/leaseRoutes.ts`
- `rentchain-api/src/routes/landlordInboxRoutes.ts`
- `rentchain-api/src/lib/reviewSummary.ts`
- `rentchain-api/src/routes/__tests__/leaseRoutes.active.test.ts`
- `rentchain-api/src/services/__tests__/applicationConversionService.test.ts`
- `rentchain-api/src/routes/__tests__/tenantPortalRoutes.test.ts`
- `rentchain-api/src/routes/landlord.test.ts`

## Landlord Walkthrough Findings

### Dashboard

Status: pass

The Dashboard provides decision and action entry points into the RC1 flow. Decision Queue Preview route labeling distinguishes:

- lease-level payment decisions to the payment ledger
- operations queue work to `/operations`
- revenue pressure to `/analytics?entry=revenue-pressure`
- vacancy readiness to `/analytics?entry=vacancy-readiness`

This matches the recent route QA direction and avoids treating portfolio revenue pressure as a lease-level ledger issue.

### Operations

Status: pass

Operations is now a direct landlord mobile bottom-nav destination and remains available in the drawer. This addresses the prior discoverability issue for `/operations` without adding a broader navigation redesign.

Operations continues to function as the command-center surface for payment ledger source workflows, payment ledger review, and operational review work.

### Applications

Status: pass with one follow-up candidate

The Applications page now has improved desktop spacing, readable mobile Risk Summary layout, status filters that include in-progress records, and no-email in-progress reminder states that avoid offering impossible reminder actions.

Application browser print/export now includes a richer review package:

- application summary
- context
- contact
- applicant profile
- household and co-applicant context
- references
- current housing and residential history
- screening/risk/decision guidance
- viewing requests
- flags
- notes

The Application Review Summary route is available at `/applications/:applicationId/review-summary`, and the backend PDF now renders a compact expanded review summary after #1296. However, the route is still easiest to discover only after selecting an application and finding the review-summary action. This is not a demo blocker, but it remains an action visibility concern for unguided users.

Recommended follow-up:

`audit/application-review-summary-discoverability-v1`

### Application to Lease Conversion

Status: pass for notification safety; end-to-end tenant reflection still needs demo-fixture proof

The conversion service now creates an internal tenant/invite relationship without tenant-facing `Lease available` email. Tests assert that conversion can create a hashed tenant invite and tenant record while leaving `tenantNotifications`, `tenantMessages`, `messages`, `emailOutbox`, and `outbox` empty.

Lease creation and occupied-unit conversion also gate lease availability email on tenant-safe primary document readiness. Schedule A and internal lease creation do not count as tenant-safe primary lease availability.

The remaining audit gap is not the email gate. It is full end-to-end reflection: one deterministic RC1 fixture should prove that a converted application appears in the tenant profile/dashboard with the expected current lease and does not overstate document, signature, or payment availability.

Recommended follow-up:

`test/rc1-landlord-tenant-reflection-fixture-v1`

### Leases and Rent Payment Readiness

Status: pass

`/leases` exposes:

- lease summary
- primary document availability state
- Schedule A separation
- `Payment ledger`
- staged payment setup actions
- `Enable rent collection` only when readiness is `ready_to_configure`
- `Review rent terms` when rent collection is not enabled because prerequisites such as due day are missing

`/leases/:leaseId/summary?section=rent-payment` remains the correct route for resolving rent/payment setup details.

This aligns landlord actionability with tenant-facing readiness copy.

### Lease Ledger

Status: pass

The lease ledger remains accessible from lease contexts and decision contexts through `Payment ledger` labeling. The page includes mobile-readable ledger cards, collapsed CSV import, user-facing decision context, and print/PDF output that includes real ledger content rather than only shell/header/footer content.

### Unified Inbox

Status: pass

The deployed #1293 backend validated read-state persistence end to end. Opening unread messages decreases the count, refresh preserves the read state, and reopening an already-read message does not decrement repeatedly.

This is demo-ready for landlord message triage.

### Analytics

Status: pass

The analytics destination routes for:

- `/analytics?entry=revenue-pressure`
- `/analytics?entry=vacancy-readiness`

have acceptable mobile and desktop/tablet layouts after #1288 and #1289. Dashboard CTAs continue to route correctly.

## Tenant Reflection Findings

### Tenant Profile

Status: pass with end-to-end fixture gap

`/tenant/profile` surfaces tenant-safe profile information, property display context, lease status, rental record, rent, lease dates, and lease document status. It uses tenant-safe profile and document vault projections rather than raw landlord/internal data.

The profile is capable of reflecting active/current lease state, but this audit did not run a live single-record conversion and tenant login flow to prove a freshly converted application updates all tenant profile fields in one continuous scenario.

### Tenant Dashboard / Workspace

Status: pass

`/tenant/dashboard` shows:

- active tenant workspace context
- dashboard summary
- application status
- lease status
- payment readiness
- rent collection enabled/not enabled
- latest payment status
- recent activity/notifications
- links to lease, documents, and payments

Payment readiness copy uses the same readiness object that distinguishes rent amount, due day, lease dates, tenant linkage, lease execution, and required next action. It does not offer tenant checkout unless payment rails are enabled and readiness allows the payment flow.

### Tenant Lease Page

Status: pass

`/tenant/lease` now avoids the prior contradiction where provider signing could be complete while the page said `Signature workflow not started`.

When provider signing is complete and no tenant-safe signed document URL exists, the page can show:

- `Lease signature complete`
- `Signing complete; signed copy pending`
- `The provider-backed signing workflow is complete. The signed copy is still being prepared for this tenant workspace.`
- `Signing is complete, but no tenant-safe signed lease document link is available yet.`

When a tenant-safe signed document exists, the backend document context can surface `Signed lease document` through the primary lease document context.

Schedule A remains separate from primary lease document availability.

### Tenant Payments

Status: pass

Tenant payment readiness distinguishes:

- `Review rent terms`
- missing due day
- rent collection not enabled
- `ready_to_configure`
- enabled payment rails
- latest payment status

The tenant does not see a `Pay rent` action unless rent collection is enabled and readiness allows checkout.

### Tenant Document Vault

Status: pass for signed-copy-pending; needs fixture coverage for signed-document-available state

The tenant document vault correctly avoids showing a signed lease when no tenant-safe signed document context exists. This is expected in signed-copy-pending scenarios.

The code path can surface tenant-safe signed documents from signing request storage metadata, lease document context, or tenant-safe attachments. A deterministic RC1 demo fixture should still cover the positive case where provider signing is complete and a tenant-safe signed document is available, so the document vault shows the signed lease.

Recommended follow-up:

`test/tenant-signed-document-vault-reflection-v1`

### Tenant Messages / Notifications

Status: pass for conversion email suppression; broader notification consistency needs scenario coverage

Application conversion no longer sends tenant-facing lease-available email. That is the highest-risk notification issue found during the previous sequence.

This audit did not find a new source-code contradiction in tenant messages, but a full RC1 fixture should verify that tenant-visible messages/notifications are consistent after:

- conversion to internal lease
- send-for-signature
- signing complete
- signed copy pending or available
- payment readiness changes

## State Consistency Matrix

| Landlord action/state | Expected tenant reflection | Current/actual tenant reflection from source and recent QA | Status |
| --- | --- | --- | --- |
| Dashboard lease-level payment decision routes to ledger | Tenant state should not change from navigation alone | Landlord route goes to `/leases/:leaseId/ledger`; tenant portal remains projection-driven | Pass |
| Dashboard portfolio revenue pressure routes to analytics | Tenant state should not imply lease-specific payment action | Dashboard labels route to `/analytics?entry=revenue-pressure` | Pass |
| Landlord reviews `/operations` queue | Tenant state should not change unless an action is taken | Operations is discoverable from mobile nav and drawer | Pass |
| Landlord reviews application summary | Tenant state should not change from read-only review | Applications page and decision panel remain landlord-only | Pass |
| Landlord prints application summary | Tenant state should not change; export should avoid raw IDs | Frontend print is richer and safe; backend PDF validated post-deploy for no raw Application ID or Screening reference | Pass |
| Landlord converts application to tenant/lease context | Tenant profile should show tenant-safe converted application/lease context; no premature lease-available email | Conversion creates tenant/invite relationship and suppresses tenant-facing email; full live reflection needs deterministic fixture proof | Gap |
| Landlord creates internal lease without tenant-safe primary document | Tenant should not receive `Lease available`; tenant document section should not claim generated/signed lease is available | Backend tests and #1282 QA support suppression; tenant lease page handles missing primary document | Pass |
| Landlord generates Schedule A only | Tenant should not treat Schedule A as primary lease document | Tenant lease page and backend document context keep Schedule A separate | Pass |
| Provider signing complete without tenant-safe signed document | Tenant should see signing complete and signed copy pending, not workflow not started | Tenant lease page renders signed-copy-pending state | Pass |
| Provider signing complete with tenant-safe signed document | Tenant should see signed lease document and vault entry | Source supports this through signed document context; current dataset coverage should be proven with fixture | Gap |
| Due day missing / rent terms incomplete | Tenant should see `Review rent terms`, due day needed, rent collection not enabled, no checkout | Tenant workspace and lease page render this state | Pass |
| Rent collection ready but not enabled | Tenant should not see checkout until landlord enables rail | Tenant checkout button requires enabled rail and ready state | Pass |
| Rent collection enabled | Tenant should see pay/retry action when payment experience permits | Tenant workspace and lease page gate checkout on enabled rail and current payment state | Pass |
| Landlord opens unread inbox message | Landlord unread count persists after refresh; tenant state unrelated | #1293 post-deploy QA passed | Pass |
| Landlord exports lease ledger | Tenant state should not change; landlord export should include meaningful ledger evidence | #1294 QA passed | Pass |

## Export and Evidence Readiness Findings

Status: pass

The two highest-value export surfaces are now demo-credible:

- Lease ledger Print / Save PDF includes lease/property/unit context, ledger summary, obligations/payment entries, balances/statuses, and relevant decision context.
- Application Review Summary PDF includes expanded curated sections and no longer exposes raw `Application ID` or `Screening reference`.

Remaining export guardrail:

- Keep using `Not provided` where no safe display value exists. Do not fall back to raw property, unit, application, tenant, provider, storage, or document IDs.

## Mobile and Navigation Findings

Status: pass with polish follow-up

Recent navigation and layout work substantially improves RC1 demo usability:

- Operations is a direct mobile bottom-nav tab.
- More/drawer remains available.
- Applications page spacing and mobile Risk Summary are readable.
- Analytics mobile and desktop layouts are acceptable.
- Lease ledger mobile cards and print output are usable.

Remaining polish:

- Application Review Summary discoverability is still not as obvious as the main Applications page print action.
- A guided demo can find the route, but an unguided landlord may not know where to obtain the canonical backend review-summary PDF.

Recommended follow-up:

`fix/application-review-summary-action-visibility-v1`

## Backend Parity Notes

#1296 backend parity has been validated post-deploy. The backend Application Review Summary PDF now reflects the #1296 merge output.

For future RC1 walkthrough QA, backend parity should be explicitly checked when the path depends on:

- tenant portal projections
- lease conversion notification gating
- signed document projection
- unified inbox read persistence
- backend-generated PDFs
- payment readiness and checkout gating

Vercel preview freshness alone is not enough for backend-dependent QA.

## Prioritized Follow-Up Mission Queue

### P0: Demo blockers

None identified in this audit.

### P1: State integrity / tenant reflection

1. `test/rc1-landlord-tenant-reflection-fixture-v1`

   Objective: create a deterministic RC1 fixture or Playwright/manual QA script that covers application approval/conversion, lease setup, tenant profile reflection, tenant lease page reflection, payment readiness, document vault, inbox state, and export access for one traceable demo record.

   Acceptance criteria:

   - Starts from a known approved application.
   - Converts or links the record into tenant/lease context without tenant-facing lease-available email.
   - Tenant profile shows the correct property, lease status, rent, and lease dates.
   - Tenant lease page shows correct signing/document/payment readiness state.
   - Tenant payment page does not offer checkout until rent collection is enabled.
   - Tenant document vault shows no signed lease when signed-copy-pending and shows the signed lease when tenant-safe signed document metadata exists.
   - No raw internal IDs appear in tenant-facing or export surfaces.

2. `test/tenant-signed-document-vault-reflection-v1`

   Objective: cover the positive signed-document case where provider signing is complete and tenant-safe signed document metadata exists.

   Acceptance criteria:

   - Tenant lease page shows `Signed lease document`.
   - Tenant document vault shows the signed lease.
   - Schedule A remains separate.
   - No storage path, provider ID, signing request ID, or raw lease ID is exposed.

### P2: Navigation / discoverability

3. `fix/application-review-summary-action-visibility-v1`

   Objective: make the canonical backend Application Review Summary PDF action easier to find from the application review workflow without changing export content.

   Acceptance criteria:

   - Landlord can identify the canonical review-summary export from the selected application context.
   - Browser print and backend review-summary PDF are labeled distinctly.
   - No new raw IDs or provider references appear.
   - Existing Applications filters, decision panel, and print export continue to work.

4. `polish/rc1-demo-navigation-friction-v1`

   Objective: tune route-to-route demo flow copy and shortcuts after a full fixture-backed walkthrough identifies exact friction.

   Acceptance criteria:

   - No broad nav redesign.
   - Only route labels/actions proven confusing during RC1 fixture QA are changed.
   - Mobile and desktop landlord navigation remain stable.

### P3: Polish

5. `polish/tenant-profile-rental-record-clarity-v1`

   Objective: if RC1 demo QA shows tenant profile users need clearer current-lease emphasis, refine the profile Rental record card without widening tenant data projection.

   Acceptance criteria:

   - Current lease is easy to identify.
   - Document and payment readiness links remain tenant-safe.
   - No raw internal IDs are exposed.

## Audit Validation

Required validation for this docs-only audit:

- `git diff --check`
- competitor-name scan
- docs-only diff confirmation
- working tree clean before PR handoff
