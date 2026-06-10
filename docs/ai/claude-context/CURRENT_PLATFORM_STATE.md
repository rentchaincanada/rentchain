# Current Platform State

## Platform Status

RentChain is in active Pilot 0 (internal portfolio).
Pilot 1 authorization pending two pre-flight fixes.

Main branch: commit after PR #1130 (feat/unified-inbox-navigation-v1)
Certification: PASS WITH CONDITIONS

## Recent PR History

| PR | Mission | Status |
|---|---|---|
| #1116 | Pilot workflow certification | merged |
| #1117 | Tenant notices Mailgun fix | merged |
| #1118 | Work order property dropdown fix | merged |
| #1119 | Contractor invite portal visibility | merged |
| #1120 | Viewing request tenant notification | merged |
| #1121 | Landing page login CTA | merged |
| #1122 | Login page UX consolidation | merged |
| #1123 | Unified inbox event model audit | merged |
| #1124 | Unified inbox data layer | merged |
| #1125 | GET /api/landlord/inbox | merged |
| #1126 | GET /api/tenant/inbox | merged |
| #1127 | GET /api/contractor/inbox | merged |
| #1128 | Viewing cancellation notification | merged |
| #1129 | Unified inbox data layer expansion | merged |
| #1130 | Unified inbox navigation — all 3 roles | merged |

## Unified Inbox — Live

- /landlord/unified-inbox: messages, viewings, work orders, notices, applications
- /tenant/inbox: messages, notices, viewings, maintenance, application status
- /contractor/inbox: work order communications

Manual browser QA confirmed working.

Known issues before Pilot 1:
- Debug metadata visible (Total visible records / Returned / Role)
- Inbox not in landlord bottom nav

## Test Accounts (Production Firebase)

- admin+landlord@rentchain.ai → UID: PmRAHPoO31dRpqtfp0RdXtL8Paw1 (plan: pro)
- admin+tenant@rentchain.ai → UID: LpG2liFLA0dn5jIDH4MtE59L4CD2
- admin+contractor@rentchain.ai → UID: olxqDL9gkfRbJwk78yKpw7BCxVa2

Firestore test data: test-property-001, test-unit-001, test-lease-001
monthlyRent: 1500 (int64), baseRentCents: 150000, dueDay: 1

## Pilot 0 — COMPLETE

All conditions met. Stripe test mode validated. Elite upgrade confirmed.

## Pre-Pilot 1 Sequence

1. fix/unified-inbox-debug-metadata-removal-v1 — NEXT
2. fix/landlord-inbox-navigation-surface-v1
Pilot 1 authorized after both complete.

## Post-Pilot 1 UX Queue

1. fix/profile-completion-v1
2. fix/maintenance-file-upload-v1 (HIGH)
3. fix/lease-status-language-simplification-v1
4. fix/primary-lease-document-v1
5. fix/operations-page-simplification-v1
6. fix/lease-ledger-financial-presentation-v1
7. feat/dashboard-visualization-v1

## Strategic Position

Technology Readiness: 9/10
Workflow Readiness: 8.5/10
UX Readiness: 6.5/10

Governing question: Does this reduce friction for landlords, tenants, contractors?
Phase 5: PARKED (v2.0)
Next milestone: First external paying landlord using RentChain successfully.

## Active Conditions

- Signing provider pending (Dropbox Sign / BoldSign)
- Certn outreach in progress
- GCS document upload wiring pending
- Stripe test mode: validated

## Claude Operating Style

Direct, minimal responses. No long explanations.

Auth boundary test pattern:
PORT=3100 npm run dev 2>&1 | grep "listening" &
sleep 5
curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/api/[route]
kill %1

Gate 2 manual override: document 401 result, write gate2-instruction.md, paste to Codex.
Cowork: short summary after each merge.
ChatGPT: full status at strategic checkpoints.
Mission cycle: @mission-generator → @mission-reviewer → Gate 1 → Codex → @qa-reviewer → Gate 2 → merge.

qa-reviewer override patterns:
- Manual QA block on auth routes: test 401, document, manual Gate 2
- Stale PR context: rewrite impl-summary.md header
- Vague governance block: check mission-review.md, re-run or manual Gate 2

## Tools

- prepend-pr-header.sh: ~/dev/rentchain/tools/prepend-pr-header.sh
- Cowork: post-merge cleanup
- Handoff: .handoff/mission-current.md, impl-summary.md, qa-review.md, gate2-instruction.md, merge-log.md
- Agents: mission-generator, mission-reviewer, qa-reviewer (Claude Code)
- Codex: implementation
