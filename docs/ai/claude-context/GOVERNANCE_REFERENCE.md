# Governance Reference

This file defines the shared governance vocabulary Claude, Codex, and reviewers should use when discussing RentChain. It is reference documentation only; it does not change runtime behavior.

## Implementation Status Labels

- **Implemented**: materially present in current code, routes, docs, tests, or UI surfaces. Implementation depth may vary by feature.
- **In Development**: partial foundations, helpers, read models, tests, docs, or preview surfaces exist, but complete workflow execution is not proven.
- **Planned / Roadmap**: strategic direction only. Requires future scoped missions, governance review, tests, QA, and deployment verification before it can be described as live.
- **Needs Verification**: a claim requires source-code, route, payload, deployment, or QA confirmation before being upgraded.

Route or page existence means a surface exists. It does not prove full production workflow depth, external integration, legal certification, or deployed-backend freshness.

## Projection-Safe

Projection-safe means every audience receives an explicit, minimal, role-appropriate view of data.

Required posture:

- tenant-facing views use whitelist projections
- landlord, admin/support, export, dashboard, timeline, analytics, debug, and public-safe contexts remain separate
- raw Firestore IDs, storage paths, provider payloads, raw documents, tokens, secrets, debug payloads, and unrestricted policy internals are excluded from user-facing labels and exports
- ambiguous audience, ownership, role, or policy context fails closed

Projection safety is not broad field stripping after loading everything. It is intentional audience-specific shaping.

## Append-Safe

Append-safe means operational history is preserved through additive records, events, references, or summaries rather than silent overwrite, deletion, or hidden mutation.

Required posture:

- preserve audit continuity
- prefer immutable or append-compatible review history
- do not erase actor, route-source, evidence, consent, or decision lineage
- do not add approve, resolve, dismiss, enforcement, financial mutation, or remediation behavior unless explicitly scoped

Append-safe does not mean every helper currently writes to persistence. Some foundations are contracts, read models, or readiness layers only.

## Metadata-First

Metadata-first means review, trust, evidence, and export workflows should expose safe summaries, status, provenance, redaction, counts, references, and readiness context before exposing any underlying sensitive payload.

Required posture:

- use safe summaries instead of raw notes, raw documents, screening reports, provider payloads, or request/response bodies
- include consent, redaction, retention, route-source, or evidence-reference context where relevant
- avoid claiming external submission, signed packages, legal artifacts, or institution handoffs unless current deployed routes prove them

## Supervised AI

Supervised AI means AI can assist review, triage, drafting, analysis, and QA, but it does not autonomously execute operational outcomes.

Required posture:

- keep Codex implementation scoped to operator-approved missions
- keep Claude recommendations labeled as required fix, recommended improvement, future mission, or strategic note
- keep Playwright deterministic and evidence-oriented
- require explicit operator authorization for merge, deploy, production mutation, scope expansion, or workflow execution

Avoid language that implies autonomous remediation, hidden enforcement, agent-driven escalation, or unsupervised status mutation.

## Controlled Operational Routing

Controlled operational routing means incidents, escalations, support notes, evidence references, and review workspaces can be grouped or surfaced for human review without automatically mutating business records.

Required posture:

- route-source attribution remains visible where present
- recommendations and review summaries are not workflow execution
- support/admin metadata stays internal unless an approved projection exposes a safe summary
- tenant and landlord visibility must not be widened by review routing

## Institutional Readiness

Institutional readiness means RentChain is preparing governed infrastructure for future lender, insurer, auditor, government, subsidy/program, legal, and institutional workflows.

Required posture:

- distinguish readiness from live external integration
- treat subsidy, welfare support, housing program, settlement, disbursement, inter-agency sharing, compliance certification, and KYC/identity assurance as planned or verification-gated unless source code and deployed payloads prove a specific implemented slice
- preserve consent, redaction, retention, authorization, projection safety, and manual review

## Evidence and Export Governance

Evidence/export governance means evidence lineage, trust packages, export previews, and institutional summaries remain consent-aware and redaction-aware.

Required posture:

- expose metadata-safe evidence references before raw payloads
- avoid raw tenant documents, private messages, screening reports, provider payloads, storage paths, or debug payloads
- separate preview/readiness surfaces from live submission, legal certification, or partner handoff
- verify Cloud Run backend revision and representative payloads before treating export behavior as current deployed truth

## Tenant Visibility Limits

Tenant visibility must not expand by accident.

Required posture:

- tenant views should not receive landlord-only, admin-only, support-only, or internal review metadata
- landlord views should not receive tenant-private data beyond approved landlord operational projections
- public/share/export views should be narrower than authenticated internal views
- no raw internal IDs should be used as primary labels

## Governance Review Checklist

Before upgrading a claim or implementing a mission, verify:

- Which audience sees the data?
- Is the output projection-safe?
- Is history append-safe?
- Is the workflow metadata-first?
- Is AI supervised?
- Does routing mutate anything?
- Is institutional language readiness-only or implemented?
- Are tenant consent and visibility boundaries preserved?
- Is Cloud Run/Vercel deployment alignment relevant?
- Are implemented, in-development, planned, and needs-verification states clearly labeled?
