# Mission Queue

## Status Key
- queued
- active
- in_review
- blocked
- merged
- trigger

## Current Focus

Current platform focus:

- lease trust
- dashboard clarity
- user guidance
- conversion readiness

Do not start Phase 5, tokenization, institutional workflows, unrestricted assistant behavior, or Certn integration until the relevant trigger or operator approval is explicit.

## A. Immediate Lease Trust / Documentation Sequence

Lease signing now works end to end. The next risk is trust, clarity, legal/documentation alignment, and signed-document polish.

| Priority | Mission | Branch | Status | Purpose |
|---:|---|---|---|---|
| 1 | Lease template production readiness messaging | `fix/lease-template-production-readiness-messaging-v1` | queued | Clarify draft/test counsel-review messaging and avoid overclaiming legal readiness. |
| 2 | Nova Scotia lease compliance and completeness audit | `audit/ns-lease-compliance-and-completeness-v1` | queued | Audit NS lease template completeness against the Form P reference and current product data model. |
| 3 | Lease status panel simplification | `fix/lease-status-panel-simplification-v1` | queued | Reduce excessive workflow guidance text and convert details into compact links. |
| 4 | Signing field placement | `feat/signing-field-placement-v1` | queued | Add stable signature anchors or provider field definitions so signatures land on lease signature lines. |
| 5 | Signed lease document security review | `fix/signed-lease-document-security-review-v1` | queued | Review signed document URL access, expiry, projection, and storage behavior after live preview use. |

Lease status panel simplification should keep compliance content available but de-emphasized behind compact links:

- Rent Increase Workflow
- Notice Workflow
- Deposit Workflow

## B. Dashboard And User Guidance Sequence

Dashboard cleanup and the user assistance entrypoint were intentionally held, not removed.

| Priority | Mission | Branch | Status | Purpose |
|---:|---|---|---|---|
| 6 | Dashboard 2.0 design | `design/dashboard-2.0-v1` | queued | Use Pilot 1 feedback and prior dashboard audits to design a cleaner, more visually engaging landlord dashboard. |
| 7 | Dashboard cleanup and engagement implementation | `fix/dashboard-cleanup-and-engagement-v1` | queued | Implement the approved Dashboard 2.0 cleanup after design review. |
| 8 | RentChain help assistant entrypoint | `feat/rentchain-help-assistant-entrypoint-v1` | queued | Add a safe static/documentation-backed user assistance entrypoint. |

Dashboard 2.0 design inputs:

- Landlord #1 feedback
- Landlord #2 feedback
- Landlord #3 feedback
- `audit/dashboard-engagement-v1`
- `audit/free-tier-journey-v1`
- `audit/landlord-command-surface-v1`

Dashboard 2.0 focus:

- cleaner first view
- less bland dashboard
- charts and graphs only where meaningful
- occupancy visualization
- rent collection visualization
- maintenance activity
- applicant funnel
- lease expiry timeline
- portfolio health
- action-first layout
- reduced decision/operations overwhelm

Charts should show evidence that RentChain is working for the landlord. Do not add charts for decoration.

Dashboard cleanup implementation should likely include:

- cleaner summary layout
- improved KPI strip
- meaningful visual widgets
- better spacing
- mobile/tablet refinement
- de-emphasized decision inbox
- less overwhelming language
- clear daily action/value panel

Help assistant initial scope:

- visible help/chat icon or Ask RentChain floating entrypoint
- static FAQ/documentation-backed responses first
- route users to approved RentChain help, legal, and support content
- landlord onboarding help for property, units, applicants, screening, signing, lease documents, and plan unlocks
- no unrestricted AI answers
- no legal advice automation
- disclaimers where needed

Future AI-powered assistant behavior requires an approved knowledge base, legal guardrails, and escalation paths before implementation.

## C. Commercial Dependency

| Priority | Mission | Branch | Status | Trigger |
|---:|---|---|---|---|
| 9 | Certn integration | `feat/certn-integration-v1` | trigger | Immediately becomes priority 1 when Certn provides API access, sandbox access, partner approval, and pricing/onboarding path. |

Until Certn access is available, continue the controlled internal roadmap above.

## Notes

- Branches are reserved in mission files but should only be created when the mission is activated.
- Codex must validate the active branch before implementation and stop if it is incorrect.
- Each mission should begin with a short audit of source-of-truth files before coding.
- Do not run dependent missions until their required predecessor missions are merged unless explicitly approved.
- Future roadmap remains strategic context until explicitly activated by the operator.
