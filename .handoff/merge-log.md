# Merge Summary

Date: 2026-06-10
Strategic status: PILOT 1 AUTHORIZED

## Merged PRs

### PR #1131
- PR URL: https://github.com/rentchaincanada/rentchain/pull/1131
- Branch: fix/unified-inbox-debug-metadata-removal-v1
- Merge commit: 23bcc30f7d477bb0365222e61249c4a9620e471b
- Result: already merged into `main` before this combined Gate 2 pass; live state re-verified.

### PR #1132
- PR URL: https://github.com/rentchaincanada/rentchain/pull/1132
- Branch: fix/landlord-inbox-navigation-surface-v1
- Merge commit: 9422dd403f25eaffa2a07980bd61c4cdb368bff6
- Result: merged into `main` during this combined Gate 2 pass.

## Final Check Status

### PR #1131
- backend: pass
- frontend: pass
- merge-gate: pass
- Terraform: pass
- Vercel preview: pass
- Vercel status: pass
- review workflow: pass
- post-review-comment: skipped

### PR #1132
- backend: pass
- frontend: pass
- merge-gate: pass
- Terraform: pass
- Vercel preview: pass
- Vercel status: pass
- review workflow: pass
- post-review-comment: skipped

## Scope Confirmation

### Mission 1: Debug Metadata Removed
- Removed internal fields from public unified inbox API responses:
  - `sourceId`
  - `sourceRef`
  - `audienceScopeKey`
  - `rawIdsIncluded`
  - `tokensIncluded`
  - `secretsIncluded`
  - `providerPayloadIncluded`
  - `storagePathIncluded`
  - `privateNotesIncluded`
- Public unified inbox records remain constrained to allowlisted response fields.
- No billing, auth, screening, deployment, dependency, or protected-area changes.

### Mission 2: Landlord Mobile Navigation Surface
- Added landlord mobile bottom navigation access to `/landlord/unified-inbox`.
- Preserved existing More drawer control.
- Updated mobile tab grid to six columns for the new Inbox entry plus existing controls.
- No backend, route, auth, response-shape, or dependency changes.

## Cleanup
- Local `main` synced to `origin/main` at merge commit `9422dd403f25eaffa2a07980bd61c4cdb368bff6`.
- Local branch `fix/unified-inbox-debug-metadata-removal-v1`: absent.
- Remote branch `fix/unified-inbox-debug-metadata-removal-v1`: absent.
- Local branch `fix/landlord-inbox-navigation-surface-v1`: deleted.
- Remote branch `fix/landlord-inbox-navigation-surface-v1`: deleted.

## Pilot 1 Authorization
PILOT 1 AUTHORIZED.

Pre-Pilot blockers resolved:
- Mission 1: debug metadata removed from unified inbox API responses.
- Mission 2: landlord mobile navigation includes unified inbox.
- Data safety governance compliance achieved.
- Mobile and desktop UX parity established for landlord unified inbox access.

## Known Limitations For Pilot 1 Phase
- Manual Network tab inspection remains required in Pilot 1 QA using staging or preview with seeded authenticated users.
- Verify unified inbox response bodies contain only allowlisted public fields.
- Verify no `sourceId`, `sourceRef`, `audienceScopeKey`, diagnostic flags, tokens, storage paths, provider payloads, or private notes appear in network responses.
- Cross-role isolation requires seeded environment verification.
- Full mobile breakpoint testing remains required for 375px, 390px, 393px, and 768px with authenticated landlords.

## Post-Pilot 1 UX Priority Queue
1. fix/profile-completion-v1
2. fix/maintenance-file-upload-v1
3. fix/lease-status-language-simplification-v1
4. fix/primary-lease-document-v1
5. fix/operations-page-simplification-v1
6. fix/lease-ledger-financial-presentation-v1
7. feat/dashboard-visualization-v1

---

## Pilot 1 Onboarding Findings — 2026-06-10

### Status
Pilot 1 remains active. Property onboarding is now the highest operational priority.

### Critical Finding
Self-serve property onboarding failed.
- Property #1: FAIL
- Property #2: FAIL
- Property #3: PASS
- Success rate: 33% — not acceptable for self-service onboarding.

### Audit Hypotheses
- CSV template edited in Apple Numbers or Google Sheets introduces BOM characters, trailing commas, or inconsistent line endings.
- Optional "Unit & Rents" section during property creation does not show CSV preview.
- CSV preview appears from property/units table upload but not from optional property creation flow.
- Split implementation between two upload entry points — behavior and validation may differ.
- Occupancy guide may be resolving units by placeholder IDs rather than persisted Firestore IDs.

### Inbox Finding
- /landlord/inbox and /landlord/unified-inbox both exist, creating navigation confusion.
- Action: consolidate to single Inbox entry point. Legacy route to redirect.

### Free Tier Finding
- Manual applicant workflow vs Starter application invitations upgrade path is acceptable.
- Explanation is not currently clear to new landlords.

### Revised Priority Queue
1. audit/property-onboarding-workflow-v1
2. fix/unit-csv-import-v1
3. fix/unit-manual-save-v1
4. fix/occupancy-guide-unit-resolution-v1
5. fix/inbox-route-consolidation-v1
6. fix/free-tier-upgrade-path-clarity-v1
7. feat/rentchain-help-assistant-v1
8. (previous post-Pilot 1 UX queue follows after above)

### Next Mission
audit/property-onboarding-workflow-v1

---

## Merge Summary - PR #1136 - 2026-06-11

### PR
- PR: #1136
- URL: https://github.com/rentchaincanada/rentchain/pull/1136
- Branch: fix/occupancy-guide-unit-resolution-v1
- Base: main
- Merge commit: 5d11c1949f2f3ec41cba17df74220e498f1905b7
- Merge method: squash merge
- Authorization: admin-authorized Gate 2 instruction in `.handoff/gate2-instruction.md`

### Final Check Status
- backend: pass
- frontend: pass
- review workflow: pass
- merge-gate: pass
- Terraform Cloud/Rentchain/repo-id-KeMiLzWpFf7Yq2Zr: pass
- Vercel Preview Comments: pass
- Vercel - rentchain: pass
- Vercel - rentchain-status: pass
- post-review-comment: skipped

### Scope Confirmed
- Blocked occupancy edit entry points from opening the unit edit modal when unit references are placeholders.
- Added modal-level guard so unresolved unit IDs cannot submit to the unit update API.
- Preserved persisted unit updates for occupancy status, tenant or occupant name, and lease end date.
- Mapped missing-unit failures to a clear refresh/save-units message.
- Added regression coverage for placeholder rejection and persisted occupancy fields.
- No auth, Firestore rules, dependency, route, or schema changes were included.

### Cleanup
- Local `main` synced to `origin/main` at `5d11c1949f2f3ec41cba17df74220e498f1905b7`.
- Local branch `fix/occupancy-guide-unit-resolution-v1`: deleted.
- Remote branch `fix/occupancy-guide-unit-resolution-v1`: deleted.
- Pre-existing local uncommitted work was preserved in stash entry `stash@{0}` before cleanup.

### Known Limitations
- GitHub reported `mergeStateStatus=BLOCKED` before merge because review was required; merge proceeded using the explicit admin-authorized Gate 2 instruction.
- `post-review-comment` was skipped by its workflow and was not a blocker.

### Recommended Next Mission
fix/inbox-route-consolidation-v1

---

## Merge Summary - PR #1139 - 2026-06-11

### PR
- PR: #1139
- URL: https://github.com/rentchaincanada/rentchain/pull/1139
- Branch: fix/free-tier-upgrade-path-clarity-v1
- Base: main
- Merge commit: 359af242ebd4de1ec3bb65d12b51dfa024850d22
- Merge method: squash merge
- Authorization: gate2-approved instruction in `.handoff/gate2-instruction.md`

### Final Check Status
- backend: pass
- frontend: pass
- codex-review: pass
- merge-gate: pass
- Terraform Cloud/Rentchain/repo-id-KeMiLzWpFf7Yq2Zr: pass
- Vercel Preview Comments: pass
- Vercel - rentchain: pass
- Vercel - rentchain-status: pass
- post-review-comment: skipped

### Scope Confirmed
- Added centralized tier guidance constants and copy validation.
- Added free tier upgrade guidance to property creation.
- Added contextual Starter guidance near the applications workflow.
- Added free tier indicator and Upgrade to Starter CTA to property overview.
- Preserved existing entitlement, billing, auth, pricing, route, and backend behavior.
- No protected backend, Firestore rules, deployment, pricing, billing, or auth areas were changed.

### Cleanup
- Local `main` synced to `origin/main` at `359af242ebd4de1ec3bb65d12b51dfa024850d22`.
- Local branch `fix/free-tier-upgrade-path-clarity-v1`: deleted.
- Remote branch `fix/free-tier-upgrade-path-clarity-v1`: deleted.
- Local working tree confirmed clean on `main` before handoff file updates.

### Known Limitations
- Manual QA was not run locally.
- Preview QA remains recommended for free-plan landlord property creation, applications, and property overview surfaces.
- Existing frontend build chunk warning was not addressed.

### Recommended Next Mission
feat/rentchain-help-assistant-v1

---

## Pilot 1 Adoption Findings — Landlord 1 — 2026-06-11

### Profile
- Free tier, 15 units, self-managed
- Outcome: would continue as Starter or Pro
- Most useful: Dashboard, Analytics, Work Orders, Payments, Expenses

### Platform-Wide Rule
A gated feature must never feel like an error.
Free-tier gated features must show: what the feature does, why unavailable, which plan unlocks it, clear upgrade path.
Must never show: raw 403, generic network error, broken page, silent failure.

### Critical Findings
- FINDING 1: Apple Numbers CSV export fails (Google Sheets succeeds) — primary Mac onboarding blocker
- FINDING 2: Guided add-unit modal "units not found" — placeholder ID bug not fully resolved by PR #1136
- FINDING 3: /leases 403 upgrade_required — raw error, no upgrade prompt
- FINDING 4: /operations 403 — "command center could not load" raw error

### High Findings
- FINDING 5: Free tier feels broken rather than limited — damages upgrade intent
- FINDING 6: /decision-inbox most confusing page — needs simplification before scaling
- FINDING 7: Numbers CSV still failing despite PR #1134

### Medium Findings
- FINDING 8: Add property form takes too much space — should collapse by default
- FINDING 9: /onboarding-hardening visible to external landlords — should be hidden
- FINDING 10: My account duplicated in nav drawer and top of page
- FINDING 11: Messages in top nav should merge with Inbox (confirmed our direction)

### Upgrade Drivers Confirmed
Analytics, Payments, Work Orders, Expenses, Maintenance concept

### Revised Priority Queue
1. audit/free-tier-gated-feature-ux-v1
2. fix/free-tier-gated-feature-ux-v1
3. fix/unit-guided-modal-save-v1
4. fix/numbers-csv-compatibility-v1
5. fix/decision-inbox-simplification-v1
6. fix/properties-add-form-collapsed-v1
7. fix/onboarding-hardening-visibility-v1

### Hold
feat/rentchain-help-assistant-v1 — hold until Pilot 1 findings reviewed

### Next Mission
audit/free-tier-gated-feature-ux-v1

---

## Merge Summary - PR #1140 - 2026-06-12

### PR
- PR: #1140
- URL: https://github.com/rentchaincanada/rentchain/pull/1140
- Branch: audit/free-tier-gated-feature-ux-v1
- Base: main
- Merge commit: 5671a6e8cebc9ba615c4d26a505f76d1c0d7e5b2
- Merge method: squash merge
- Authorization: gate2-approved instruction in `.handoff/gate2-instruction.md`

### Final Check Status
- backend: pass
- frontend: pass
- review workflow: pass
- merge-gate: pass
- Terraform Cloud/Rentchain/repo-id-KeMiLzWpFf7Yq2Zr: pass
- Vercel Preview Comments: pass
- Vercel - rentchain: pass
- Vercel - rentchain-status: pass
- post-review-comment: skipped

### Scope Confirmed
- Documented free tier gated feature UX audit summary.
- Identified 15 gated or tier-sensitive surfaces.
- Documented 4 critical findings and 6 high-priority findings.
- No source code, routes, services, tests, billing, auth, entitlement, Firestore rules, or deployment files changed.
- PR changed only `.handoff/impl-summary.md`; local audit notes were preserved in `.handoff/mission-current.md`.

### Cleanup
- Local `main` synced to `origin/main` at `5671a6e8cebc9ba615c4d26a505f76d1c0d7e5b2`.
- Local branch `audit/free-tier-gated-feature-ux-v1`: deleted.
- Remote branch `audit/free-tier-gated-feature-ux-v1`: deleted.
- Pre-existing local changes preserved: `.gitignore`, `.handoff/merge-log.md`, `tools/start-cycle-watchers.sh`, `tools/watch-mission-review.sh`.

### Known Limitations
- Audit findings were code-audit based; no live preview session was run.
- Pilot 1 session recordings were not available in this workspace.
- Working tree is not globally clean because unrelated local edits predated this merge and the requested handoff updates are local.

### Recommended Next Mission
fix/free-tier-gated-feature-ux-v1

---

## Merge Summary - PR #1141 - 2026-06-12

### PR
- PR: #1141
- URL: https://github.com/rentchaincanada/rentchain/pull/1141
- Branch: fix/free-tier-gated-feature-ux-v1
- Base: main
- Merge commit: 0583f53163de435ffdb4e9146fedce60bb698a7e
- Merge method: squash merge
- Authorization: gate2-approved instruction in `.handoff/gate2-instruction.md`

### Final Check Status
- backend: pass
- frontend: pass
- review workflow: pass
- merge-gate: pass
- Terraform Cloud/Rentchain/repo-id-KeMiLzWpFf7Yq2Zr: pass
- Vercel Preview Comments: pass
- Vercel - rentchain: pass
- Vercel - rentchain-status: pass
- post-review-comment: skipped

### Scope Confirmed
- Implemented free tier locked feature UX for leases, ledger, ledger v2, messages, and operations signals.
- Normalized backend upgrade-required response shape for lease, ledger, ledger v2, and messaging gates.
- Preserved free-safe operations content while showing locked lease-driven lanes.
- Centralized operations locked-state copy.
- Documented the Pilot 1 maintenance decision without changing enforcement.
- No auth middleware, billing, Firestore rules, deployment, pricing, or entitlement allow-list changes were made.

### Preview QA
- Queued preview QA for free-tier dashboard, leases, ledger, and messages flows.
- Vercel preview QA results in `.handoff/impl-summary.md`: critical scope passed.
- Low follow-up finding: `/expenses` upgrade copy is plain text rather than a styled CTA.
- `/messages` was not visible in Free tier nav during QA; confirm this remains intentional.

### Cleanup
- Local `main` synced to `origin/main` at `0583f53163de435ffdb4e9146fedce60bb698a7e`.
- Local branch `fix/free-tier-gated-feature-ux-v1`: deleted.
- Remote branch `fix/free-tier-gated-feature-ux-v1`: deleted.
- Temporary handoff stash used during branch switch was applied and dropped.

### Known Limitations
- Frontend build large chunk warning remains pre-existing.
- Working tree is not globally clean after required local handoff updates.

### Recommended Next Mission
fix/expenses-upgrade-copy-cta-v1

---

## Strategic Update — 2026-06-12

### Phase Shift
Platform has moved from "Can it work?" to "Will landlords adopt it?"
Every future finding evaluated through adoption lens.

### Platform Principle Confirmed
Limited, not broken. PR #1141 enforces this platform-wide.

### Revised Priority Queue
1. fix/unit-guided-modal-save-v1 — guided occupancy/unit modal still failing
2. fix/numbers-csv-compatibility-v1 — Mac + Numbers CSV must work consistently
3. fix/landlord-command-surface-simplification-v1 — reduce decision-inbox overwhelm
4. Confirm /messages Free tier visibility — intentional or accidental

### Pilot 1 Status
Active. Continue onboarding. Collect:
- onboarding findings
- support requests
- upgrade objections
- upgrade drivers

### Hold
feat/rentchain-help-assistant-v1 — hold until Pilot 1 findings reviewed

### Next Mission
fix/unit-guided-modal-save-v1

---

## Merge Summary - PR #1142 - 2026-06-12

### PR
- PR: #1142
- URL: https://github.com/rentchaincanada/rentchain/pull/1142
- Branch: fix/unit-guided-modal-save-v1
- Base: main
- Merge commit: 2e1f59b3f5292860aacb930a7c676233795480cb
- Merge method: squash merge
- Authorization: gate2-approved instruction in `.handoff/gate2-instruction.md`

### Final Check Status
- backend: pass
- frontend: pass
- merge-gate: pass
- codex-review: pass
- Terraform Cloud/Rentchain/repo-id-KeMiLzWpFf7Yq2Zr: pass
- Vercel Preview Comments: pass
- Vercel - rentchain: pass
- Vercel - rentchain-status: pass

### Scope Confirmed
- Manual unit creation returns created unit records with stable Firestore IDs.
- Placeholder unit IDs are rejected before occupancy updates with UNIT_ID_UNRESOLVED.
- Property units flow stores only persisted unit records after save responses include stable IDs.
- Unit edit modal stays open and shows retryable messaging if a save response omits a stable ID.
- Property detail state replaces edited units when a save response returns a different persisted ID.
- No auth middleware, billing, Firestore rules, deployment, entitlement, dependency, or protected-area changes were included.

### Cleanup
- Local `main` synced to `origin/main` at `2e1f59b3f5292860aacb930a7c676233795480cb`.
- Local branch `fix/unit-guided-modal-save-v1`: deleted.
- Remote branch `fix/unit-guided-modal-save-v1`: deleted.
- Local working tree confirmed clean on `main` except handoff file updates before this summary commit.

### Known Limitations
- Frontend focused tests emitted an existing duplicate-key warning in the property creation test harness for `prop-created`; tests passed.

### Summary
Unit guided modal save ID persistence fix merged; all checks green; stable ID validation prevents unresolved unit state.
