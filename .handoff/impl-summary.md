PR: #TBD
PR URL: TBD
Branch: fix/free-tier-landlord-experience-v1

WHAT WAS DONE:
Implemented the first free-tier landlord journey simplification pass focused on clarity, action order, and navigation prominence.

- Added a dashboard journey card that puts the primary setup order first: Add property -> Add unit -> Add applicant -> Run screening.
- Reordered dashboard fallback actions so free landlords see property, unit, applicant, and screening steps in the intended sequence.
- Moved the dashboard Decision Inbox summary into a collapsed lower-priority section instead of placing it beside the main KPI strip.
- Reordered quick actions to favor Add property, Add unit, and Add applicant before secondary actions.
- Updated landlord mobile tabs to prioritize Dashboard, Properties, Applicants, and Inbox, with More for secondary pages.
- De-emphasized Operations and Decisions from the primary landlord drawer while keeping their routes available for deep links and future workflows.
- Updated nav configuration tests and dashboard regression tests for the new action-order narrative.

KEY DECISIONS:
- Kept entitlement enforcement, route signatures, billing logic, backend gates, Firestore rules, and API contracts unchanged.
- Kept Decision Inbox available but reduced its prominence for the free-tier journey.
- Kept Messages as a gated route and removed it from the mobile primary tab sequence to avoid duplicate Inbox/Messages mental models.
- Preserved the existing Properties page guidance and Add Units modal path because it already carries the property -> unit flow and recent persistence fixes.
- Used existing navigation and dashboard components instead of adding a new app shell or dependency.

CURRENT STATE:
- Branch: fix/free-tier-landlord-experience-v1
- PR: pending
- Source changes are frontend-only.
- Handoff-only local files outside this mission were not staged.

VALIDATION:
- `npm test -- DashboardPage.test.tsx LandlordNav.test.tsx` passed.
- `git diff --check` passed.
- `source ~/.nvm/nvm.sh && nvm use 20.11.1 && npm run build` passed. Vite emitted its existing Node preference warning for Node 20.19+, but the build completed successfully under the repo-pinned Node 20.11.1.
- `npm test` passed: 306 files, 1214 tests.
- `npm run lint` passed.

KNOWN LIMITATIONS:
- Manual preview QA was not run in this local execution.
- Operations page content was not redesigned; this mission only de-emphasizes it from the primary free-tier navigation.
- Locked-state copy still relies on the existing `LockedFeature` and upgrade copy system. No entitlement or billing copy source of truth was changed.
- Messages and Inbox remain separate surfaces; this mission only reduces mobile navigation duplication.

NEXT STEP:
Run preview QA for the free-tier landlord dashboard and navigation:
- Dashboard shows setup order before decision/review language.
- Mobile bottom nav fits cleanly and shows Dashboard, Properties, Applicants, Inbox, More.
- Drawer no longer promotes Operations or Decisions as primary free-tier choices.
- Property -> unit -> applicant -> screening path is understandable in the first 30 minutes.
