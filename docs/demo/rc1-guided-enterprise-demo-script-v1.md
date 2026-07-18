# RC1 Guided Enterprise Demo Script v1

Branch: `docs/rc1-guided-demo-script-v1`
Scope: guided RC1 landlord demo script only; no product implementation or production-readiness certification.

## 1. Demo Purpose

This script presents RentChain RC1 as a governed housing operations command layer for a landlord or property manager evaluating a one-building pilot.

The walkthrough demonstrates how an operator moves from portfolio signals into review work, source messages, application review, lease follow-through, payment visibility, screening status, maintenance, analytics, and contractor coordination. It emphasizes role boundaries, safe routing, landlord-facing language, and review-oriented workflows.

RC1 is not presented as a full production launch of payments, provider-backed signing, screening-provider execution, email delivery, or legal notice service. Capabilities must be described according to the visible and separately validated state of the environment used for the demo.

## 2. Demo Audience

- Serious pilot landlord evaluating one building.
- Property manager or operating team lead.
- Enterprise or institutional evaluator reviewing governance and workflow continuity.
- Optional admin/support reviewer, when the admin-only segment is intentionally included.

## 3. Pre-Demo Setup Checklist

Complete this checklist against the exact environment that will be presented.

- [ ] Sign in with a landlord account for the primary walkthrough.
- [ ] Confirm the deployed build matches the approved RC1 release or preview.
- [ ] Confirm demo data exists for Dashboard, Applications, Leases, Maintenance, and Verified Screenings where populated states will be discussed.
- [ ] Identify one application that can open Application Review Summary.
- [ ] Confirm Application Review Summary loads and its PDF download works.
- [ ] Identify one lease with usable summary and ledger routes.
- [ ] Confirm `/verified-screenings` loads for the landlord account.
- [ ] Treat `No verified screenings yet` as an acceptable safe empty state if no records exist.
- [ ] Show `/admin/verified-screenings` only when the audience and account are explicitly admin/support oriented.
- [ ] Confirm browser zoom is 100% and the intended desktop or responsive viewport is stable.
- [ ] Close debug overlays, development tools, stale tabs, and unrelated customer data.
- [ ] Confirm there is no stale branch, frontend preview, or backend deployment mismatch.
- [ ] Do not use production customer data or expose private tenant information beyond the approved demo fixture.
- [ ] Keep a fallback application and lease route ready in case a selected record has incomplete demo data.

## 4. Route-by-Route Walkthrough

### A. Dashboard

**Route:** `/dashboard`

**What to click**

1. Open the Decision Queue Preview.
2. Point out a renewal or application activity card.
3. Open a supported destination only if its demo record is ready.

**What to say**

> Dashboard is the operating front door. It summarizes portfolio state and surfaces the highest-priority items that need human review. The cards are navigation and context, not hidden automation: opening one does not mutate workflow state.

> Renewal and application cards use supported routes and neutral wording. RentChain guides the operator into the owning workspace without implying that a message was sent, a payment moved, or a decision was made automatically.

**What the page proves**

- Portfolio and operational context can be reviewed from one starting surface.
- Decision Queue Preview connects signals to supported workspaces.
- User-facing labels avoid raw queue, source, lease, provider, or storage identifiers.
- Review navigation remains supervised and non-mutating.

**What not to claim**

- Do not claim Dashboard decisions execute workflows automatically.
- Do not claim renewal cards send email or establish legal notice service.
- Do not claim application activity language is an autonomous risk or approval decision.
- Do not claim payment cards initiate PAD or move money.

**Fallback language**

> This environment does not currently have a populated example for that card. The empty or reduced state is intentional; the Dashboard only shows supported review items available from current data.

### B. Operations

**Route:** `/operations`

**What to click**

1. Open Operations from Dashboard or landlord navigation.
2. Review the operational queue and its source-workflow actions.
3. Select `Open operational inbox` to continue into Unified Inbox.

**What to say**

> Operations is the command workspace. Dashboard tells the operator what deserves attention; Operations provides the fuller review queue and bridges the operator into message context and source workflows.

> The goal is governed coordination. RentChain organizes work and preserves human review rather than automatically resolving exceptions.

**What the page proves**

- Dashboard and Operations have distinct, complementary roles.
- Operators can move from high-level status into source-backed work.
- Unified Inbox is part of the operational path rather than a disconnected message center.

**What not to claim**

- Do not describe queue placement as autonomous remediation.
- Do not claim every queue item has a record-specific route when safe context is unavailable.

**Fallback language**

> This queue reflects the work available in the current demo dataset. Where an exact source route is not safely available, RentChain keeps a broader, honestly labelled workspace action.

### C. Unified Inbox

**Route:** `/landlord/unified-inbox`

**What to click**

1. Open a landlord inbox record.
2. Point out its source label and action.
3. Follow a safe application, lease, maintenance, payment, or work-order action when available.

**What to say**

> Unified Inbox connects communication context to operational work. Safe source actions are generated from approved backend projections, so the frontend does not reconstruct internal lineage or expose raw source identifiers.

> When exact safe context exists, the operator receives a focused route. When it does not, the product uses a broader workspace fallback rather than guessing.

**What the page proves**

- Communication and operational routing are connected.
- Source-aware actions can be useful without exposing internal objects.
- Broad fallbacks preserve safety when record-specific routing is unavailable.

**What not to claim**

- Do not claim every message resolves to an exact source record.
- Do not interpret a broad workspace fallback as missing or corrupted data.
- Do not claim opening an inbox action mutates the underlying workflow.

**Fallback language**

> An exact record route is not available from this safely projected message, so RentChain opens the related workspace without guessing at internal lineage.

### D. Applications

**Route:** `/applications`

**What to click**

1. Review application status filters and funnel context.
2. Select a prepared application.
3. Point out landlord-facing screening and decision guidance.
4. Open Application Review Summary.

**What to say**

> Applications organizes applicant review and follow-through. The surface uses landlord-facing workflow language and keeps provider references and internal IDs out of the normal review experience.

> Application activity can be reviewed here, but analytics and screening context support the operator's judgment; they do not replace it.

**What the page proves**

- Application records can be reviewed in a structured workspace.
- Screening, viewing, risk, status, and decision context remain supervised.
- The normal path exposes a curated Review Summary instead of requiring a hidden URL.

**What not to claim**

- Do not show or narrate `Order ID`, `Reference ID`, `Copy reference ID`, `STUB`, or raw provider language as landlord features.
- Do not claim the screening provider integration is production-ready unless separately validated.
- Do not claim automated approval or rejection.

**Fallback language**

> No submitted applications match this filter in the current dataset. The empty state is accurate; we can change filters or use the prepared application to continue the review workflow.

### E. Application Review Summary

**Route:** `/applications/:applicationId/review-summary`

**What to click**

1. Review the applicant, property/unit, employment/income, screening, activity, and decision sections.
2. Open the simplified Decision tab.
3. Show detailed lease readiness behind its disclosure when useful.
4. Download the PDF review packet.
5. Use the safe lease follow-through action to open `/leases` when the record state supports it.

**What to say**

> This is the landlord review packet. It assembles curated context for human review without exposing raw application, provider, property, unit, or storage references as display labels.

> Guidance is status-aware. Final approved or declined applications do not continue to show active pre-decision controls. Detailed lease readiness is available when needed without overwhelming the primary Decision view.

> Lease follow-through opens the safe broad lease workspace. RentChain does not infer an exact lease route when that relationship is not present in the approved projection.

**What the page proves**

- Review context is consolidated into a readable evidence-oriented summary.
- Final application states produce appropriate guidance and controls.
- PDF/export supports a clean review artifact.
- The application-to-lease handoff remains safe when exact linkage is unavailable.

**What not to claim**

- Do not claim the summary makes the landlord's decision.
- Do not claim a lease exists unless the visible state proves it.
- Do not claim every missing source value is a defect.
- Do not imply an exact application-to-lease relationship when the route only opens `/leases`.

**Fallback language**

> `Not provided` means the approved source data does not contain a safe value for this field. RentChain preserves that uncertainty instead of substituting an internal identifier or invented value.

### F. Leases

**Route:** `/leases`

**What to click**

1. Open the lease workspace from Application Review Summary.
2. Select a prepared lease.
3. Open Lease Summary and Payment Ledger.

**What to say**

> Leases is the safe broad destination after application review. The workspace presents landlord-facing lease context and supported next actions without showing raw lease IDs as labels.

> From here, the operator can continue into summary, ledger, or supported lease workflows according to the record's current state.

**What the page proves**

- Application review can continue into a usable lease workspace.
- Lease records provide clear summary and ledger actions.
- Missing exact handoff context does not require unsafe route inference.

**What not to claim**

- Do not claim a lease is signed or legally complete based only on its presence in the workspace.
- Do not claim payment collection is enabled unless the visible readiness state proves it.

**Fallback language**

> This lease is present as an operational record. Its visible status and readiness fields determine which actions are supported next.

### G. Lease Summary

**Route:** `/leases/:leaseId/summary`

**What to click**

1. Review lease, tenant, property, document, signing, and payment context.
2. Point out supported links to the ledger or Operations.
3. Open signing or document actions only when their visible state is ready.

**What to say**

> Lease Summary organizes the lease context and the next supported actions. Readiness and document states remain explicit so an operator can distinguish internal preparation from completed execution.

**What the page proves**

- Lease information and operational state are consolidated.
- Signing, document, and payment states can remain separate.
- The operator has controlled paths into ledger and operational review.

**What not to claim**

- Do not claim provider-backed e-signing is live unless separately validated in this environment.
- Do not claim signature state establishes legal completion.
- Do not claim a document is tenant-safe unless the visible document state confirms it.

**Fallback language**

> The workflow supports readiness and state tracking. Provider execution or legal completion is not being claimed from this record unless the environment has been separately validated for that exact lifecycle.

### H. Lease Ledger

**Route:** `/leases/:leaseId/ledger`

**What to click**

1. Review rent obligations, recorded payments, balances, and decision context.
2. Show print/export only if it is part of the planned demo.
3. Use the available return actions to continue to Lease Summary or Operations.

**What to say**

> The ledger provides operational visibility into rent obligations, recorded payments, allocation context, and follow-through. It is an evidence and review surface; it does not by itself prove that money moved through RentChain.

**What the page proves**

- Lease-level payment context is visible and reviewable.
- Dashboard and Operations decisions can land on a relevant ledger.
- Ledger output can support operational evidence and review.

**What not to claim**

- Do not claim live PAD, bank debit, settlement, or money movement unless separately implemented and validated.
- Do not claim a displayed obligation is a processor-confirmed transaction.
- Do not expand collapsed advanced references during the standard landlord demo.

**Fallback language**

> This page reflects the operational ledger data available to RentChain. Payment execution and processor settlement are separate capabilities and are not implied by this view.

### I. Landlord Verified Screenings

**Route:** `/verified-screenings`

**What to click**

1. Open Verified Screenings from landlord navigation.
2. If populated, select a screening and review its status, package, applicant, and summary labels.
3. If empty, use the empty state without switching to the admin route.

**What to say**

> This is the landlord-facing verified-screening workspace. The API returns a landlord-scoped projection with readable labels and excludes admin support identifiers, provider order references, and internal property, unit, or application IDs.

> RC1 demonstrates structured screening workflow and status infrastructure. Provider-backed execution is only described as live when it has been separately validated.

**What the page proves**

- Landlord and admin screening audiences are separated.
- Landlord records use label-first projection-safe fields.
- Screening status can be reviewed without exposing provider internals.

**What not to claim**

- Do not claim the provider integration is fully productionized unless separately validated.
- Do not show `/admin/verified-screenings` as the landlord experience.
- Do not interpret an empty landlord list as a route failure.

**Fallback language**

> `No verified screenings yet` is the correct safe empty state for this account. The route and landlord projection are available; this dataset does not currently contain a populated record.

### J. Maintenance

**Route:** `/maintenance`

**What to click**

1. Review maintenance requests and the calendar/default work density.
2. Open a prepared request if one is available.
3. Relate the page back to Unified Inbox source routing.

**What to say**

> Maintenance extends the command-center model into operational service work. Requests, scheduling context, and follow-through remain visible without turning message classification into automatic execution.

**What the page proves**

- Operational requests can be reviewed in a dedicated workspace.
- Inbox context can route safely into maintenance work.
- The layout supports quick scanning across current work.

**What not to claim**

- Do not claim autonomous dispatch, contractor assignment, or invoice payment.
- Do not imply every inbox record has an exact maintenance request route.

**Fallback language**

> The current dataset has limited maintenance activity. The empty or light state reflects available work rather than a failed workflow.

### K. Analytics

**Route:** `/analytics`

**What to click**

1. Open a prepared revenue-pressure, vacancy-readiness, or application-funnel context.
2. Point out supporting values and the route back into operational work.

**What to say**

> Analytics provides decision support for the operator. It helps organize patterns and supporting context, while the operator remains responsible for review and action.

**What the page proves**

- Portfolio signals connect to supported review destinations.
- Analytics can support a governed operational conversation.
- The product separates insight from autonomous execution.

**What not to claim**

- Do not claim analytics are authoritative forecasts or guaranteed outcomes.
- Do not claim automated approval, rejection, pricing, remediation, or outreach.
- Do not describe generated signals as autonomous AI decisions.

**Fallback language**

> This signal is decision-support based on the data available in the current view. It is a prompt for human review, not a guaranteed forecast or automated decision.

### L. Contractors

**Route:** `/contractors`

**What to click**

1. Review contractor directory and coordination context.
2. Show invite history or a prepared contractor record if available.
3. Demonstrate responsive cards only if this supporting module fits the timebox.

**What to say**

> Contractors supports operational coordination and relationship visibility around service work. It is a supporting workspace, not a claim of autonomous marketplace dispatch.

**What the page proves**

- Contractor records and invite history can support property operations.
- The workspace fits the broader governed operations model.
- Mobile-safe presentations preserve usability for field-oriented work.

**What not to claim**

- Do not claim a fully automated marketplace, dispatch network, procurement flow, or contractor payment system.
- Do not claim contractors are assigned automatically from maintenance signals.

**Fallback language**

> This environment shows the coordination foundation. Automated dispatch, procurement, and contractor payment remain outside the demonstrated RC1 scope.

### M. Optional Admin Verified Screenings

**Route:** `/admin/verified-screenings`

**When to show it**

Show this route only when the audience is explicitly reviewing admin/support operations and an admin account is available. Do not include it in the ordinary landlord path.

**What to click**

1. Sign in with an authorized admin account.
2. Open a support record only if its fixture is approved for the audience.
3. Contrast the support surface with the landlord projection.

**What to say**

> This is a separately guarded admin/support surface. Support identifiers are intentionally available here for operational investigation, while the landlord route receives a narrower label-first projection.

**What the page proves**

- Frontend and API role boundaries separate landlord and admin audiences.
- Support workflows can retain identifiers without leaking them into the landlord experience.

**What not to claim**

- Do not present admin identifiers as landlord-facing product labels.
- Do not show private support data to an audience that is not authorized for it.
- Do not imply landlord users can open this route; they are blocked.

**Fallback language**

> We are omitting the admin surface from the landlord walkthrough. It is a separate support boundary, not part of the landlord product experience.

## 5. Concise 10–15 Minute Talk Track

| Time | Stop | Talk track |
| --- | --- | --- |
| 0:00–1:30 | Dashboard | Position RentChain as the governed operating front door. Show portfolio context and one Decision Queue Preview card. Emphasize human review and safe routing. |
| 1:30–3:00 | Operations | Show the fuller command workspace, source-workflow actions, and the bridge into Unified Inbox. |
| 3:00–4:15 | Unified Inbox | Open one record and explain backend-generated safe source actions plus honest broad fallbacks. Follow an application-related action. |
| 4:15–6:00 | Applications | Select the prepared application, show landlord-facing status/screening context, and open Review Summary. |
| 6:00–8:00 | Review Summary | Show the curated packet, simplified Decision tab, status-aware controls, lease-readiness disclosure, and PDF/export. Continue safely to Leases. |
| 8:00–9:30 | Leases and Summary | Show the broad lease workspace, select a record, and explain the separation between lease context, document readiness, signing state, and supported actions. |
| 9:30–10:45 | Ledger | Show obligations, recorded payments, balances, and decision context. State clearly that this is operational visibility, not a live PAD or settlement claim. |
| 10:45–11:45 | Verified Screenings | Use the landlord route. Show label-first projection or the acceptable empty state. Explain the separate admin boundary without opening it unless requested. |
| 11:45–13:30 | Supporting modules | Briefly show Maintenance, Analytics, and Contractors as extensions of the governed operations model. Avoid deep workflow detours. |
| 13:30–15:00 | Close | Summarize one-building pilot value: governed routing, role boundaries, review packets, workflow continuity, and enterprise-safe abstractions. Invite validation of a pilot workflow rather than claiming enterprise completeness. |

Suggested closing statement:

> RC1 demonstrates that RentChain can organize a landlord's operational path from portfolio signal to human review, source context, application evidence, lease follow-through, and supporting operations without exposing internal implementation details or hiding automation behind the interface. The next step is a controlled one-building pilot that validates the workflows and integrations required by that operator.

## 6. Do Not Claim

- Live PAD or pre-authorized debit is production-enabled.
- Live bank settlement or money movement occurred because ledger data is visible.
- Provider-backed e-signing is live unless the exact environment and lifecycle were separately validated.
- A signing state establishes legal completion.
- Legal notice sending or legal service is established by a renewal workflow.
- Live email delivery infrastructure is enabled because a communication draft exists.
- A screening provider integration is fully productionized unless separately validated.
- Screening or analytics autonomously approve, reject, price, contact, or remediate.
- Missing fields necessarily indicate an application or product error.
- Admin/support identifiers are part of the landlord-facing experience.
- Enterprise-wide migration, bulk operations, or full portfolio rollout is complete.

## 7. Approved Fallback Language

| Situation | Approved language |
| --- | --- |
| `Not provided` field | `The approved source data does not contain a safe value for this field. RentChain preserves that uncertainty rather than substituting an internal identifier or invented value.` |
| No submitted applications | `No submitted applications match the current filter. We can change filters or use the prepared application to continue the workflow.` |
| Empty verified screenings | `No verified screenings are available for this landlord account yet. The route and safe projection are working; this dataset has no populated record.` |
| Missing exact source route | `An exact record route is not available from the approved projection, so RentChain does not infer one from internal lineage.` |
| Broad fallback routing | `The action opens the related workspace safely. The operator can continue from the records available there.` |
| Screening not requested | `Screening has not been requested for this application. No provider result or decision is being implied.` |
| Provider unavailable or unvalidated | `The workflow and status boundary are visible, but provider-backed execution is not being represented as live in this environment.` |
| Admin-only identifiers | `Support identifiers are intentionally restricted to the guarded admin surface and are excluded from the landlord projection.` |
| Sparse maintenance or contractor data | `This environment contains limited supporting-module activity; the light state reflects current demo data.` |

## 8. RC1 Value Proposition

RC1 demonstrates:

- A governed operational command center rather than a collection of disconnected pages.
- Clear role boundaries between landlord and admin/support experiences.
- Source-aware workflow continuity with safe broad fallbacks.
- Human-reviewed application packets and evidence-oriented summaries.
- Landlord-facing language instead of raw IDs, provider references, storage paths, and internal objects.
- Explicit separation between operational visibility, workflow readiness, and external execution.
- A credible foundation for a controlled one-building pilot without claiming enterprise completeness.

## 9. Non-Blocking P2 Follow-Ups

These items do not block the guided RC1 walkthrough:

1. Improve continuity when the application-funnel CTA opens a submitted-status empty state.
2. Recheck populated landlord verified-screening records as more representative records become available.
3. Improve source completeness for lease start, requested rent, and similar fields that safely render `Not provided` today.
4. Add a deterministic return path for direct-link or refreshed Application Review Summary sessions.
5. Add lightweight return or next-action affordances on Analytics and Lease Ledger.
6. Maintain a separate admin demo segment for `/admin/verified-screenings` when support operations are in scope.

## Demo Completion Checklist

- [ ] The walkthrough stayed within the landlord route unless an admin segment was explicitly requested.
- [ ] No raw internal, provider, or storage identifier was narrated as a landlord-facing feature.
- [ ] No unsupported payments, signing, screening, email, notice, or automation claim was made.
- [ ] Missing and empty states were explained using approved fallback language.
- [ ] The evaluator understood what RC1 proves today and what remains a future integration or pilot-validation step.
