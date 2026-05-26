# Current Active Missions

## Source Audit

`docs/execution/CURRENT_MISSION.md` currently appears to be a placeholder template. It should not be blindly copied into Claude.ai as the live mission.

The current mission for this snapshot is operator-provided:

- branch: `docs/ai-claude-context-snapshot-v1`
- objective: create Claude.ai context snapshot files under `docs/ai/claude-context/`
- scope: documentation only

## Recently Completed Direction

Recent merged work, based on current docs and branch history, has focused on:

- AI cowork protocol and Dev Container/Playwright/Cloud Run QA foundations
- tenant message read-state and refresh synchronization
- tenant profile/document readiness consistency
- tenant mobile bottom navigation
- admin tenant/lease projection consistency
- landlord/admin mobile layout and navigation polish
- governed review workspace foundations, read routes, admin page, navigation, and fixtures
- support escalation runbooks, history, review notes, and admin review surface
- admin security incident review surface
- impersonation governance and support/admin projection safety

## Next Recommended Themes

Potential next mission themes, subject to operator activation:

- role-specific Playwright smoke specs using `PREVIEW_URL`
- tenant profile card typography/responsive polish
- tenant message realtime QA hardening if further preview issues appear
- governed review workspace write governance only after append-only controls are explicitly approved
- Cloud Run deployment verification automation that remains non-mutating by default
- Claude context maintenance process to keep upload snapshots current

## Known Follow-Up Areas

- Avoid stale backend deployment drift by verifying Cloud Run revision/image/traffic for backend missions.
- Keep tenant, landlord, and admin mobile navigation separate.
- Keep institutional export/trust work consent-scoped and manual-review-first.
- Preserve projection safety when connecting admin/support review surfaces.

## Uncertainty Note

This file summarizes current direction from available docs and recent branch context. If a new operator prompt or active PR contradicts this snapshot, that newer prompt/PR is the mission source of truth.
