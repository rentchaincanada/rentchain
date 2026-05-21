# Controlled Agent Routing Readiness v1

## Executive summary

This report establishes RentChain's first controlled agent routing readiness foundation. It defines metadata and review semantics for future supervised operational assistance without enabling autonomous execution, AI provider calls, workflow mutation, auto-routing, auto-approval, or external agent runtimes.

The implementation adds a deterministic metadata helper and tests. It does not change routes, auth, Firestore schema, Firestore rules, permissions, UI visibility, financial records, exports, evidence packs, reviews, consent records, or operational workflows.

## Controlled routing philosophy

Controlled agent routing must start as governance metadata, not automation.

Future agent-assisted workflows may help operators summarize context, suggest manual routes, or prepare drafts for human review. They must not execute actions, approve decisions, mutate records, share data, or bypass server-side authority.

Core principles:

- human operators remain accountable for actions
- landlord/admin scope must be server-authority resolved
- source refs remain internal metadata
- tenant-visible agent internals remain disabled
- financial, legal, evidence/export, consent, credential, and admin/support actions require human review
- autonomous execution remains explicitly disabled
- future AI calls require separate approval, logging, redaction, and incident-response posture

## Agent-readiness classes

| Class | Meaning | Execution posture |
| --- | --- | --- |
| `not_agent_eligible` | Context is not metadata-only or lacks required governance shape. | No agent use. |
| `summarize_only` | Safe internal metadata can be summarized for operators. | No execution. |
| `suggest_route` | A manual routing suggestion may be surfaced when scoped refs exist. | Manual review only. |
| `prepare_draft` | A draft may be prepared for later explicit approval. | Human approval required before any action. |
| `requires_human_approval` | Human review is mandatory before even draft-like use expands. | Manual review only. |
| `blocked` | Requested behavior is unsafe or autonomous. | Prohibited. |

## Action risk classes

| Risk class | Meaning | Baseline handling |
| --- | --- | --- |
| `informational` | Internal summary or status context. | Metadata-only summary allowed. |
| `operational_metadata` | Routing/status/review metadata without mutation. | Manual routing suggestion may be allowed. |
| `tenant_visible` | Any action or draft that may affect tenant-visible surfaces. | Explicit human approval required. |
| `financial` | Payment, ledger, delinquency, billing, reconciliation, or obligation context. | Explicit human approval; no mutation. |
| `legal_notice` | Lease notice, legal document, or regulated communication context. | Explicit human approval; no auto-send. |
| `evidence_export` | Evidence pack, export, trust package, or institutional package context. | Explicit human approval and projection profile required. |
| `consent_sensitive` | Consent, revocation, sharing, or coordination context. | Explicit human approval; no auto-consent. |
| `credential_security` | Secrets, tokens, webhooks, incident security, or credential handling. | Admin approval required; no automated rotation. |
| `admin_support` | Privileged admin/support context. | Admin/support review only. |
| `prohibited_autonomous` | Any requested autonomous execution, approval, or resolution. | Blocked. |

## Human approval model

| Approval requirement | Meaning |
| --- | --- |
| `none_for_metadata_only` | Only safe informational summaries are permitted. |
| `review_required` | Operator must review before acting. |
| `explicit_approval_required` | Human must explicitly approve any draft, message, export, notice, or workflow action. |
| `admin_approval_required` | Admin/support authority is required for privileged or credential/security contexts. |
| `prohibited` | The action class is not allowed. |

## Blocked action categories

Always blocked in this foundation:

- autonomous execution requests
- auto-created reviews
- auto-routed work
- auto-approved decisions
- auto-resolved decisions
- financial mutation
- lease/document/legal notice mutation
- consent grant/revocation automation
- public/institutional sharing automation
- credential rotation or secret handling automation
- tenant-visible agent internals
- unrestricted raw/provider/debug/token payload handling

## Routing metadata contract

The V1 helper defines:

- `controlledRoutingVersion`
- `routingContextId`
- `landlordId`
- `tenantId`
- `requestedAction`
- `actionRiskClass`
- `readinessClass`
- `humanApprovalRequirement`
- `reviewWorkspaceCompatible`
- `manualHandoffOnly`
- `sourceRefs`
- `blockedReasons`
- safety flags disabling execution, auto-routing, auto-approval, external AI providers, tenant-visible internals, and financial mutation

This is not a Firestore schema and is not wired to runtime routes.

## Review workspace handoff guidance

Controlled routing readiness metadata may support future manual review handoff when:

- source refs are scoped to the same landlord and tenant where applicable
- action class is not prohibited
- review workspace compatibility is true
- explicit human approval is available for sensitive classes
- evidence/export/consent references remain metadata-only

Readiness metadata must not auto-create review workspaces. Existing review workspace foundations remain the manual coordination layer.

## Consent, evidence, export, and incident linkage expectations

Future agent-assisted routing must respect:

- evidence projection profiles
- institutional export allowlists
- tenant-safe projection contracts
- consent governance timeline semantics
- security incident metadata boundaries
- admin/support privileged access governance
- structured logging redaction rules

Agent readiness metadata may reference these artifacts by scoped internal refs only. It must not copy raw evidence payloads, raw exports, raw provider reports, consent payloads, incident internals, message bodies, tokens, secrets, debug payloads, or stack traces.

## Helper implemented

`rentchain-api/src/lib/controlledAgentRouting/controlledAgentRouting.ts` adds metadata-only helpers:

- `classifyActionRisk`
- `determineHumanApprovalRequirement`
- `classifyAgentReadiness`
- `normalizeControlledRoutingSourceRefs`
- `buildControlledRoutingReadinessRef`
- `normalizeControlledRoutingContext`

## Known limitations

- No agent runtime exists.
- No AI provider calls exist.
- No workflow mutation exists.
- No production agent orchestration exists.
- No route or UI is introduced.
- No persistence model is introduced.
- No automated approvals, routing, review creation, or resolutions exist.
- No tenant-visible agent surface exists.

## Future roadmap

1. Add route-level assertions only if future supervised agent metadata is surfaced through an API.
2. Add review-workspace handoff tests before any UI handoff controls are introduced.
3. Add consent-aware and evidence-aware policy adapters before draft/export assistance expands.
4. Add structured logging and incident telemetry only for reviewed, redacted agent metadata.
5. Add AI-provider integration only after redaction, prompt governance, audit, and human approval controls are approved.
6. Add tenant-facing explanations only through tenant-safe projection contracts and after explicit review.

## DO NOT IGNORE

- Controlled routing readiness is not agent execution.
- Metadata-only summaries must not become autonomous routing.
- Tenant-visible, financial, legal, evidence/export, consent-sensitive, credential/security, and admin/support actions require human review or admin review.
- Source refs are internal references, not primary labels or permissions.
- Future agent systems must remain authority-scoped, reviewable, auditable, and manually approved.
