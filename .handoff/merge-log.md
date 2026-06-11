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
- codex-review: pass
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
